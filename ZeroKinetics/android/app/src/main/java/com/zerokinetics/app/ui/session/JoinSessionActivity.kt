package com.zerokinetics.app.ui.session

import android.Manifest
import android.animation.ObjectAnimator
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.textfield.TextInputEditText
import com.google.gson.Gson
import com.zerokinetics.app.R
import com.zerokinetics.app.network.RetrofitClient
import com.zerokinetics.app.network.models.ErrorResponse
import com.zerokinetics.app.network.models.ValidateSessionRequest
import com.zerokinetics.app.ui.gesture.GestureVerifyActivity
import com.zerokinetics.app.utils.WifiHelper
import kotlinx.coroutines.launch

class JoinSessionActivity : AppCompatActivity() {

    private lateinit var etSessionId: TextInputEditText
    private lateinit var tvWifiStatus: TextView
    private lateinit var tvStatus: TextView
    private lateinit var btnJoin: Button
    private lateinit var progressBar: ProgressBar
    private lateinit var tvResult: TextView

    companion object {
        private const val LOCATION_PERMISSION_REQUEST = 2001
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_join_session)

        etSessionId = findViewById(R.id.etSessionId)
        tvWifiStatus = findViewById(R.id.tvWifiStatus)
        tvStatus = findViewById(R.id.tvStatus)
        btnJoin = findViewById(R.id.btnJoin)
        progressBar = findViewById(R.id.progressBar)
        tvResult = findViewById(R.id.tvResult)

        if (!WifiHelper.hasLocationPermission(this)) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION),
                LOCATION_PERMISSION_REQUEST
            )
        }

        updateWifiStatus()

        btnJoin.setOnClickListener { validateAndJoin() }

        // Entrance animation
        val title1 = findViewById<View>(R.id.tvTitle1)
        val title2 = findViewById<View>(R.id.tvTitle2)
        title1.alpha = 0f; title1.translationX = -30f
        title2.alpha = 0f; title2.translationX = -30f
        ObjectAnimator.ofFloat(title1, "alpha", 0f, 1f).apply { duration = 500; start() }
        ObjectAnimator.ofFloat(title1, "translationX", -30f, 0f).apply { duration = 500; start() }
        ObjectAnimator.ofFloat(title2, "alpha", 0f, 1f).apply { duration = 500; startDelay = 150; start() }
        ObjectAnimator.ofFloat(title2, "translationX", -30f, 0f).apply { duration = 500; startDelay = 150; start() }

        btnJoin.setOnTouchListener { v, event ->
            when (event.action) {
                android.view.MotionEvent.ACTION_DOWN ->
                    v.animate().scaleX(0.96f).scaleY(0.96f).setDuration(100).start()
                android.view.MotionEvent.ACTION_UP, android.view.MotionEvent.ACTION_CANCEL ->
                    v.animate().scaleX(1f).scaleY(1f).setDuration(100).start()
            }
            false
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == LOCATION_PERMISSION_REQUEST) {
            updateWifiStatus()
        }
    }

    private fun updateWifiStatus() {
        val wifiInfo = WifiHelper.getCurrentWifi(this)
        if (wifiInfo != null) {
            tvWifiStatus.text = "WiFi: ${wifiInfo.ssid}"
            tvWifiStatus.setTextColor(ContextCompat.getColor(this, R.color.success))
        } else if (!WifiHelper.isConnectedToWifi(this)) {
            tvWifiStatus.text = "WiFi: Not connected"
            tvWifiStatus.setTextColor(ContextCompat.getColor(this, R.color.error))
        } else {
            tvWifiStatus.text = "WiFi: Connected (grant location to detect name)"
            tvWifiStatus.setTextColor(ContextCompat.getColor(this, R.color.warning))
        }
    }

    private fun validateAndJoin() {
        val sessionId = etSessionId.text?.toString()?.trim()?.uppercase() ?: ""
        if (sessionId.isEmpty()) {
            showStatus("Enter a session code", isError = true)
            return
        }

        tvResult.visibility = View.GONE
        setLoading(true)
        showStatus("Validating session...", isError = false)

        val api = RetrofitClient.getApiService(this)

        lifecycleScope.launch {
            try {
                val response = api.validateSession(ValidateSessionRequest(sessionId))

                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!

                    if (body.sessionValid) {
                        // Check WiFi proximity
                        val wifiInfo = WifiHelper.getCurrentWifi(this@JoinSessionActivity)
                        if (wifiInfo == null) {
                            showResult(
                                "⚠ Cannot detect WiFi network.\nEnsure WiFi is connected and location permission is granted.",
                                isSuccess = false
                            )
                            return@launch
                        }

                        if (wifiInfo.bssid != body.wifiBSSID) {
                            showResult(
                                "✗ Access Denied\nYou are not connected to the classroom network.",
                                isSuccess = false
                            )
                            return@launch
                        }

                        // WiFi matches — navigate to gesture verification
                        showStatus("WiFi verified ✓ Opening gesture verification...", isError = false)
                        val intent = Intent(this@JoinSessionActivity, GestureVerifyActivity::class.java).apply {
                            putExtra(GestureVerifyActivity.EXTRA_SESSION_ID, sessionId)
                            putExtra(GestureVerifyActivity.EXTRA_COURSE_NAME, body.courseName ?: "")
                        }
                        startActivity(intent)
                        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
                        finish()
                    } else {
                        showResult("✗ ${body.error ?: "Session validation failed"}", isSuccess = false)
                    }
                } else {
                    val errorBody = response.errorBody()?.string()
                    val errorMsg = try {
                        val err = Gson().fromJson(errorBody, ErrorResponse::class.java)
                        err.error
                    } catch (_: Exception) { "Session validation failed" }
                    showResult("✗ $errorMsg", isSuccess = false)
                }
            } catch (e: Exception) {
                showResult("Network error: ${e.message}", isSuccess = false)
            } finally {
                setLoading(false)
            }
        }
    }

    private fun showStatus(msg: String, isError: Boolean) {
        tvStatus.text = msg
        tvStatus.setTextColor(
            ContextCompat.getColor(this, if (isError) R.color.error else R.color.text_secondary)
        )
        tvStatus.visibility = View.VISIBLE
    }

    private fun showResult(msg: String, isSuccess: Boolean) {
        tvResult.text = msg
        tvResult.setTextColor(
            ContextCompat.getColor(this, if (isSuccess) R.color.success else R.color.error)
        )
        tvResult.visibility = View.VISIBLE
        tvStatus.visibility = View.GONE
    }

    private fun setLoading(loading: Boolean) {
        progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        btnJoin.isEnabled = !loading
        btnJoin.alpha = if (loading) 0.5f else 1f
    }
}

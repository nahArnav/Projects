package com.zerokinetics.app.ui.faculty

import android.Manifest
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.textfield.TextInputEditText
import com.google.gson.Gson
import com.zerokinetics.app.R
import com.zerokinetics.app.network.RetrofitClient
import com.zerokinetics.app.network.models.*
import com.zerokinetics.app.ui.auth.LoginActivity
import com.zerokinetics.app.utils.WifiHelper
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class FacultyDashboardActivity : AppCompatActivity() {

    private lateinit var tvWelcome: TextView
    private lateinit var cardSession: View
    private lateinit var tvNoSession: TextView
    private lateinit var tvCourseName: TextView
    private lateinit var tvSessionId: TextView
    private lateinit var tvSessionTime: TextView
    private lateinit var tvSessionStatus: TextView
    private lateinit var tvVerifiedCount: TextView
    private lateinit var btnCreateSession: Button
    private lateinit var btnEndSession: Button
    private lateinit var btnViewAttendance: Button
    private lateinit var progressBar: ProgressBar

    private var currentSessionId: String? = null
    private var isRefreshing = false

    companion object {
        private const val LOCATION_PERMISSION_REQUEST = 1001
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_faculty_dashboard)

        tvWelcome = findViewById(R.id.tvWelcome)
        cardSession = findViewById(R.id.cardSession)
        tvNoSession = findViewById(R.id.tvNoSession)
        tvCourseName = findViewById(R.id.tvCourseName)
        tvSessionId = findViewById(R.id.tvSessionId)
        tvSessionTime = findViewById(R.id.tvSessionTime)
        tvSessionStatus = findViewById(R.id.tvSessionStatus)
        tvVerifiedCount = findViewById(R.id.tvVerifiedCount)
        btnCreateSession = findViewById(R.id.btnCreateSession)
        btnEndSession = findViewById(R.id.btnEndSession)
        btnViewAttendance = findViewById(R.id.btnViewAttendance)
        progressBar = findViewById(R.id.progressBar)

        val tokenManager = RetrofitClient.getTokenManager(this)
        val userName = tokenManager.userName ?: "Professor"
        tvWelcome.text = "Welcome, $userName"

        btnCreateSession.setOnClickListener { showCreateSessionDialog() }
        btnEndSession.setOnClickListener { endSession() }
        btnViewAttendance.setOnClickListener {
            currentSessionId?.let { id ->
                startActivity(Intent(this, SessionAttendanceActivity::class.java).apply {
                    putExtra("SESSION_ID", id)
                })
            }
        }

        findViewById<Button>(R.id.btnLogout).setOnClickListener { performLogout() }


        if (!WifiHelper.hasLocationPermission(this)) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION),
                LOCATION_PERMISSION_REQUEST
            )
        }
    }

    private fun showCreateSessionDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_create_session, null)
        val etCourse = dialogView.findViewById<EditText>(R.id.etCourseName)
        val etDuration = dialogView.findViewById<EditText>(R.id.etDuration)

        AlertDialog.Builder(this, R.style.Theme_ZeroKinetics_Dialog)
            .setTitle("Create Session")
            .setView(dialogView)
            .setPositiveButton("Create") { _, _ ->
                val courseName = etCourse.text.toString().trim()
                val duration = etDuration.text.toString().toIntOrNull() ?: 5
                if (courseName.isNotEmpty()) {
                    createSession(courseName, duration)
                } else {
                    Toast.makeText(this, "Course name is required", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun createSession(courseName: String, durationMinutes: Int) {
        val wifiInfo = WifiHelper.getCurrentWifi(this)
        if (wifiInfo == null) {
            Toast.makeText(this, "Cannot detect WiFi. Please ensure WiFi is connected and location permission is granted.", Toast.LENGTH_LONG).show()
            return
        }

        setLoading(true)
        val api = RetrofitClient.getApiService(this)

        lifecycleScope.launch {
            try {
                val response = api.createSession(
                    CreateSessionRequest(courseName, durationMinutes, wifiInfo.ssid, wifiInfo.bssid)
                )
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    currentSessionId = body.sessionId
                    showSessionActive(body.sessionId, body.courseName, body.startTime, body.endTime, "active", 0)
                    startAutoRefresh()
                    Toast.makeText(this@FacultyDashboardActivity, "Session ${body.sessionId} created!", Toast.LENGTH_SHORT).show()
                } else {
                    val errorBody = response.errorBody()?.string()
                    val errorMsg = try {
                        Gson().fromJson(errorBody, ErrorResponse::class.java).error
                    } catch (_: Exception) { "Failed to create session" }
                    Toast.makeText(this@FacultyDashboardActivity, errorMsg, Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@FacultyDashboardActivity, "Network error", Toast.LENGTH_SHORT).show()
            } finally {
                setLoading(false)
            }
        }
    }

    private fun endSession() {
        val sessionId = currentSessionId ?: return
        setLoading(true)
        val api = RetrofitClient.getApiService(this)

        lifecycleScope.launch {
            try {
                val response = api.endSession(EndSessionRequest(sessionId))
                if (response.isSuccessful) {
                    isRefreshing = false
                    tvSessionStatus.text = "ENDED"
                    tvSessionStatus.setTextColor(ContextCompat.getColor(this@FacultyDashboardActivity, R.color.error))
                    btnEndSession.visibility = View.GONE
                    Toast.makeText(this@FacultyDashboardActivity, "Session ended", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@FacultyDashboardActivity, "Network error", Toast.LENGTH_SHORT).show()
            } finally {
                setLoading(false)
            }
        }
    }

    private fun refreshSessionStatus() {
        val sessionId = currentSessionId ?: return
        val api = RetrofitClient.getApiService(this)

        lifecycleScope.launch {
            try {
                val response = api.getSessionStatus(sessionId)
                if (response.isSuccessful && response.body() != null) {
                    val s = response.body()!!
                    tvVerifiedCount.text = "Students Verified: ${s.studentsVerified}"
                    if (s.status == "ended") {
                        tvSessionStatus.text = "ENDED"
                        tvSessionStatus.setTextColor(ContextCompat.getColor(this@FacultyDashboardActivity, R.color.error))
                        btnEndSession.visibility = View.GONE
                        isRefreshing = false
                    }
                }
            } catch (_: Exception) { /* silent refresh */ }
        }
    }

    private fun startAutoRefresh() {
        isRefreshing = true
        lifecycleScope.launch {
            while (isRefreshing) {
                delay(5000)
                if (isRefreshing) refreshSessionStatus()
            }
        }
    }

    private fun showSessionActive(
        sessionId: String, courseName: String, startTime: String, endTime: String,
        status: String, studentsVerified: Int
    ) {
        cardSession.visibility = View.VISIBLE
        tvNoSession.visibility = View.GONE
        btnEndSession.visibility = View.VISIBLE
        btnViewAttendance.visibility = View.VISIBLE

        tvCourseName.text = courseName
        tvSessionId.text = "Session ID: $sessionId"

        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        val displayFmt = SimpleDateFormat("HH:mm", Locale.getDefault())
        try {
            val start = sdf.parse(startTime)
            val end = sdf.parse(endTime)
            if (start != null && end != null) {
                val diffMin = ((end.time - start.time) / 60000).toInt()
                tvSessionTime.text = "Duration: $diffMin min  •  ${displayFmt.format(start)} – ${displayFmt.format(end)}"
            }
        } catch (_: Exception) {
            tvSessionTime.text = "Duration: —"
        }

        tvSessionStatus.text = status.uppercase()
        tvSessionStatus.setTextColor(
            ContextCompat.getColor(this, if (status == "active") R.color.success else R.color.error)
        )
        tvVerifiedCount.text = "Students Verified: $studentsVerified"
    }

    private fun performLogout() {
        isRefreshing = false
        val tokenManager = RetrofitClient.getTokenManager(this)
        val api = RetrofitClient.getApiService(this)

        lifecycleScope.launch {
            try { api.logout(LogoutRequest(tokenManager.refreshToken)) } catch (_: Exception) {}
            tokenManager.clearAll()
            startActivity(Intent(this@FacultyDashboardActivity, LoginActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            })
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
            finish()
        }
    }

    private fun setLoading(loading: Boolean) {
        progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        btnCreateSession.isEnabled = !loading
    }

    override fun onDestroy() {
        super.onDestroy()
        isRefreshing = false
    }
}

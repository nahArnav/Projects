package com.zerokinetics.app.ui.gesture

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.gson.Gson
import com.zerokinetics.app.R
import com.zerokinetics.app.network.RetrofitClient
import com.zerokinetics.app.network.models.ErrorResponse
import com.zerokinetics.app.network.models.GestureVerifyResponse
import com.zerokinetics.app.network.models.SensorReadingDto
import com.zerokinetics.app.network.models.VerifyGestureRequest
import com.zerokinetics.app.sensor.GesturePreprocessor
import com.zerokinetics.app.sensor.SensorCollector
import com.zerokinetics.app.ui.dashboard.DashboardActivity
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class GestureVerifyActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_SESSION_ID = "SESSION_ID"
        const val EXTRA_COURSE_NAME = "COURSE_NAME"
    }

    private lateinit var tvGestureStatus: TextView
    private lateinit var viewGestureCircle: View
    private lateinit var tvResult: TextView
    private lateinit var progressBar: ProgressBar

    private lateinit var sensorCollector: SensorCollector
    private var isRecording = false

    private var sessionId: String? = null
    private var courseName: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_gesture_verify)

        tvGestureStatus = findViewById(R.id.tvGestureStatus)
        viewGestureCircle = findViewById(R.id.viewGestureCircle)
        tvResult = findViewById(R.id.tvResult)
        progressBar = findViewById(R.id.progressBar)

        sensorCollector = SensorCollector(this)

        // Read session extras (passed from JoinSessionActivity)
        sessionId = intent.getStringExtra(EXTRA_SESSION_ID)
        courseName = intent.getStringExtra(EXTRA_COURSE_NAME)

        animateEntrance()

        if (!sensorCollector.areSensorsAvailable()) {
            showResult("Sensors not available", isSuccess = false)
            return
        }

        viewGestureCircle.setOnClickListener {
            if (!isRecording) {
                recordAndVerify()
            }
        }
    }

    private fun animateEntrance() {
        val title1 = findViewById<View>(R.id.tvVerifyTitle1)
        val title2 = findViewById<View>(R.id.tvVerifyTitle2)
        title1.alpha = 0f; title1.translationX = -30f
        title2.alpha = 0f; title2.translationX = -30f

        ObjectAnimator.ofFloat(title1, "alpha", 0f, 1f).apply { duration = 500; start() }
        ObjectAnimator.ofFloat(title1, "translationX", -30f, 0f).apply { duration = 500; start() }
        ObjectAnimator.ofFloat(title2, "alpha", 0f, 1f).apply { duration = 500; startDelay = 150; start() }
        ObjectAnimator.ofFloat(title2, "translationX", -30f, 0f).apply { duration = 500; startDelay = 150; start() }
    }

    private fun recordAndVerify() {
        isRecording = true
        tvGestureStatus.text = getString(R.string.verify_recording)
        tvResult.visibility = View.GONE

        val pulseAnimator = ObjectAnimator.ofFloat(viewGestureCircle, "alpha", 1f, 0.5f).apply {
            duration = 400
            repeatMode = ValueAnimator.REVERSE
            repeatCount = ValueAnimator.INFINITE
        }
        pulseAnimator.start()

        lifecycleScope.launch {
            try {
                val readings = sensorCollector.recordGesture()
                pulseAnimator.cancel()
                viewGestureCircle.alpha = 1f

                if (readings.size < 10) {
                    showResult("Sample too short. Try again.", isSuccess = false)
                    isRecording = false
                    tvGestureStatus.text = getString(R.string.verify_tap_start)
                    return@launch
                }

                val processed = GesturePreprocessor.preprocess(readings)

                progressBar.visibility = View.VISIBLE
                tvGestureStatus.text = "Verifying..."

                val api = RetrofitClient.getApiService(this@GestureVerifyActivity)
                val gestureData = processed.map { r ->
                    SensorReadingDto(r.timestamp, r.ax, r.ay, r.az, r.gx, r.gy, r.gz)
                }

                val response = api.verifyGesture(VerifyGestureRequest(gestureData, sessionId))
                progressBar.visibility = View.GONE

                if (response.isSuccessful && response.body() != null) {
                    val body: GestureVerifyResponse = response.body()!!

                    if (sessionId != null) {
                        // Session-aware attendance flow
                        handleAttendanceResult(body)
                    } else {
                        // Standalone verification flow (legacy)
                        handleStandaloneResult(body)
                    }
                } else {
                    val errorBody = response.errorBody()?.string()
                    val errorMsg = try {
                        Gson().fromJson(errorBody, ErrorResponse::class.java).error
                    } catch (_: Exception) {
                        getString(R.string.error_unknown)
                    }
                    showResult(errorMsg, isSuccess = false)
                }
            } catch (e: Exception) {
                pulseAnimator.cancel()
                viewGestureCircle.alpha = 1f
                progressBar.visibility = View.GONE
                showResult(getString(R.string.error_network), isSuccess = false)
            } finally {
                isRecording = false
                tvGestureStatus.text = getString(R.string.verify_tap_start)
            }
        }
    }

    private fun handleAttendanceResult(body: GestureVerifyResponse) {
        if (body.isVerified) {
            val conf = String.format("%.1f%%", body.confidence * 100)
            val sessionLabel = body.courseName ?: courseName ?: sessionId ?: ""
            showResult(
                "✓ Attendance Verified\nSession: $sessionLabel\nScore: $conf",
                isSuccess = true
            )
            // Stay on this screen — don't navigate to dashboard
            viewGestureCircle.visibility = View.GONE
        } else {
            showResult(
                "✗ Gesture verification failed\n${body.message}\nTap the circle to try again.",
                isSuccess = false
            )
        }
    }

    private fun handleStandaloneResult(body: GestureVerifyResponse) {
        if (body.isVerified) {
            val tokenManager = RetrofitClient.getTokenManager(this@GestureVerifyActivity)
            if (body.accessToken != null && body.refreshToken != null) {
                tokenManager.saveTokens(body.accessToken, body.refreshToken)
            }

            showResult("✓ Verified (${String.format("%.1f%%", body.confidence * 100)})", isSuccess = true)

            lifecycleScope.launch {
                delay(1500)
                startActivity(Intent(this@GestureVerifyActivity, DashboardActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                })
                overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
                finish()
            }
        } else {
            showResult(
                "✗ Not verified (${String.format("%.1f%%", body.confidence * 100)})\n${body.message}",
                isSuccess = false
            )
        }
    }

    private fun showResult(message: String, isSuccess: Boolean) {
        tvResult.text = message
        tvResult.setTextColor(
            ContextCompat.getColor(this, if (isSuccess) R.color.success else R.color.error)
        )
        tvResult.visibility = View.VISIBLE
    }
}

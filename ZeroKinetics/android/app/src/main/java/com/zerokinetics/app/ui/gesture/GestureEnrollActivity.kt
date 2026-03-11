package com.zerokinetics.app.ui.gesture

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.gson.Gson
import com.zerokinetics.app.R
import com.zerokinetics.app.network.RetrofitClient
import com.zerokinetics.app.network.models.EnrollGestureRequest
import com.zerokinetics.app.network.models.ErrorResponse
import com.zerokinetics.app.network.models.GestureSampleDto
import com.zerokinetics.app.network.models.SensorReadingDto
import com.zerokinetics.app.sensor.GesturePreprocessor
import com.zerokinetics.app.sensor.SensorCollector
import com.zerokinetics.app.sensor.SensorReading
import com.zerokinetics.app.ui.dashboard.DashboardActivity
import kotlinx.coroutines.launch

class GestureEnrollActivity : AppCompatActivity() {

    private lateinit var tvCounter: TextView
    private lateinit var tvGestureStatus: TextView
    private lateinit var viewGestureCircle: View
    private lateinit var tvStatus: TextView
    private lateinit var btnSubmit: Button
    private lateinit var progressBar: ProgressBar

    private lateinit var sensorCollector: SensorCollector
    private val gestureSamples = mutableListOf<List<SensorReading>>()
    private var isRecording = false

    companion object {
        const val MIN_SAMPLES = 50
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_gesture_enroll)

        tvCounter = findViewById(R.id.tvCounter)
        tvGestureStatus = findViewById(R.id.tvGestureStatus)
        viewGestureCircle = findViewById(R.id.viewGestureCircle)
        tvStatus = findViewById(R.id.tvStatus)
        btnSubmit = findViewById(R.id.btnSubmitEnrollment)
        progressBar = findViewById(R.id.progressBar)

        sensorCollector = SensorCollector(this)

        updateCounter()
        animateEntrance()


        if (!sensorCollector.areSensorsAvailable()) {
            showStatus("Accelerometer or Gyroscope not available on this device", isError = true)
            return
        }


        viewGestureCircle.setOnClickListener {
            if (!isRecording) {
                recordSample()
            }
        }

        btnSubmit.setOnClickListener { submitEnrollment() }


        btnSubmit.setOnTouchListener { v, event ->
            when (event.action) {
                android.view.MotionEvent.ACTION_DOWN ->
                    v.animate().scaleX(0.96f).scaleY(0.96f).setDuration(100).start()
                android.view.MotionEvent.ACTION_UP, android.view.MotionEvent.ACTION_CANCEL ->
                    v.animate().scaleX(1f).scaleY(1f).setDuration(100).start()
            }
            false
        }
    }

    private fun animateEntrance() {
        val title1 = findViewById<View>(R.id.tvEnrollTitle1)
        val title2 = findViewById<View>(R.id.tvEnrollTitle2)
        title1.alpha = 0f; title1.translationX = -30f
        title2.alpha = 0f; title2.translationX = -30f

        ObjectAnimator.ofFloat(title1, "alpha", 0f, 1f).apply { duration = 500; start() }
        ObjectAnimator.ofFloat(title1, "translationX", -30f, 0f).apply { duration = 500; start() }
        ObjectAnimator.ofFloat(title2, "alpha", 0f, 1f).apply { duration = 500; startDelay = 150; start() }
        ObjectAnimator.ofFloat(title2, "translationX", -30f, 0f).apply { duration = 500; startDelay = 150; start() }
    }

    private fun recordSample() {
        isRecording = true
        tvGestureStatus.text = getString(R.string.enroll_recording)
        tvStatus.visibility = View.GONE


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
                    showStatus("Sample too short. Hold steady and try again.", isError = true)
                } else {

                    val processed = GesturePreprocessor.preprocess(readings)
                    gestureSamples.add(processed)
                    updateCounter()
                    showStatus(getString(R.string.enroll_sample_saved), isError = false)
                }
            } catch (e: Exception) {
                pulseAnimator.cancel()
                viewGestureCircle.alpha = 1f
                showStatus("Recording error: ${e.message}", isError = true)
            } finally {
                isRecording = false
                tvGestureStatus.text = getString(R.string.enroll_tap_start)
            }
        }
    }

    private fun updateCounter() {
        tvCounter.text = getString(R.string.enroll_counter, gestureSamples.size, MIN_SAMPLES)
        val hasEnough = gestureSamples.size >= MIN_SAMPLES
        btnSubmit.isEnabled = hasEnough
        btnSubmit.alpha = if (hasEnough) 1f else 0.5f
    }

    private fun submitEnrollment() {
        if (gestureSamples.size < MIN_SAMPLES) return

        setLoading(true)


        val sampleDtos = gestureSamples.map { sample ->
            GestureSampleDto(
                data = sample.map { r ->
                    SensorReadingDto(r.timestamp, r.ax, r.ay, r.az, r.gx, r.gy, r.gz)
                },
                duration = SensorCollector.DEFAULT_DURATION_MS
            )
        }

        val api = RetrofitClient.getApiService(this)

        lifecycleScope.launch {
            try {
                val response = api.enrollGesture(EnrollGestureRequest(sampleDtos))
                if (response.isSuccessful) {
                    showStatus("Enrollment successful! Model training initiated.", isError = false)

                    startActivity(Intent(this@GestureEnrollActivity, DashboardActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    })
                    overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
                    finish()
                } else {
                    val errorBody = response.errorBody()?.string()
                    val errorMsg = try {
                        Gson().fromJson(errorBody, ErrorResponse::class.java).error
                    } catch (_: Exception) {
                        getString(R.string.error_unknown)
                    }
                    showStatus(errorMsg, isError = true)
                }
            } catch (e: Exception) {
                showStatus(getString(R.string.error_network), isError = true)
            } finally {
                setLoading(false)
            }
        }
    }

    private fun showStatus(message: String, isError: Boolean) {
        tvStatus.text = message
        tvStatus.setTextColor(
            ContextCompat.getColor(this, if (isError) R.color.error else R.color.success)
        )
        tvStatus.visibility = View.VISIBLE
    }

    private fun setLoading(loading: Boolean) {
        progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        btnSubmit.isEnabled = !loading && gestureSamples.size >= MIN_SAMPLES
        viewGestureCircle.isClickable = !loading
    }
}

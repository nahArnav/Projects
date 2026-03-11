package com.zerokinetics.app.ui.auth

import android.animation.ObjectAnimator
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.material.textfield.TextInputEditText
import com.google.gson.Gson
import com.zerokinetics.app.R
import com.zerokinetics.app.network.RetrofitClient
import com.zerokinetics.app.network.models.ErrorResponse
import com.zerokinetics.app.network.models.FacultyRegisterRequest
import com.zerokinetics.app.ui.faculty.FacultyDashboardActivity
import com.zerokinetics.app.utils.Validators
import kotlinx.coroutines.launch

class FacultyRegisterActivity : AppCompatActivity() {

    private lateinit var etName: TextInputEditText
    private lateinit var etEmail: TextInputEditText
    private lateinit var etPassword: TextInputEditText
    private lateinit var etFacultyCode: TextInputEditText
    private lateinit var btnRegister: Button
    private lateinit var tvError: TextView
    private lateinit var progressBar: ProgressBar

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_faculty_register)

        etName = findViewById(R.id.etName)
        etEmail = findViewById(R.id.etEmail)
        etPassword = findViewById(R.id.etPassword)
        etFacultyCode = findViewById(R.id.etFacultyCode)
        btnRegister = findViewById(R.id.btnRegister)
        tvError = findViewById(R.id.tvError)
        progressBar = findViewById(R.id.progressBar)

        animateEntrance()

        btnRegister.setOnClickListener { performRegister() }

        findViewById<TextView>(R.id.tvBackToLogin).setOnClickListener {
            finish()
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        }

        btnRegister.setOnTouchListener { v, event ->
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
        val title1 = findViewById<View>(R.id.tvTitle1)
        val title2 = findViewById<View>(R.id.tvTitle2)
        title1.alpha = 0f; title1.translationX = -30f
        title2.alpha = 0f; title2.translationX = -30f

        ObjectAnimator.ofFloat(title1, "alpha", 0f, 1f).apply { duration = 500; start() }
        ObjectAnimator.ofFloat(title1, "translationX", -30f, 0f).apply { duration = 500; start() }
        ObjectAnimator.ofFloat(title2, "alpha", 0f, 1f).apply { duration = 500; startDelay = 150; start() }
        ObjectAnimator.ofFloat(title2, "translationX", -30f, 0f).apply { duration = 500; startDelay = 150; start() }
    }

    private fun performRegister() {
        val name = etName.text?.toString()?.trim() ?: ""
        val email = etEmail.text?.toString()?.trim() ?: ""
        val password = etPassword.text?.toString() ?: ""
        val facultyCode = etFacultyCode.text?.toString()?.trim() ?: ""

        if (name.isEmpty() || email.isEmpty() || password.isEmpty() || facultyCode.isEmpty()) {
            showError("All fields are required")
            return
        }
        if (!Validators.isValidEmail(email)) {
            showError("Invalid email format")
            return
        }

        setLoading(true)
        hideError()

        val deviceId = RetrofitClient.getDeviceIdManager(this).getDeviceId()
        val api = RetrofitClient.getApiService(this)

        lifecycleScope.launch {
            try {
                val response = api.registerFaculty(
                    FacultyRegisterRequest(name, email, password, deviceId, facultyCode)
                )
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    val tokenManager = RetrofitClient.getTokenManager(this@FacultyRegisterActivity)
                    tokenManager.saveTokens(body.accessToken, body.refreshToken)
                    tokenManager.saveUser(body.user.id, body.user.name, body.user.email, "faculty")

                    startActivity(Intent(this@FacultyRegisterActivity, FacultyDashboardActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    })
                    overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
                    finish()
                } else {
                    val errorBody = response.errorBody()?.string()
                    val errorMsg = try {
                        Gson().fromJson(errorBody, ErrorResponse::class.java).error
                    } catch (_: Exception) {
                        "Registration failed"
                    }
                    showError(errorMsg)
                }
            } catch (e: Exception) {
                showError("Network error. Check your connection.")
            } finally {
                setLoading(false)
            }
        }
    }

    private fun showError(message: String) {
        tvError.text = message
        tvError.visibility = View.VISIBLE
    }

    private fun hideError() { tvError.visibility = View.GONE }

    private fun setLoading(loading: Boolean) {
        progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        btnRegister.isEnabled = !loading
        btnRegister.alpha = if (loading) 0.5f else 1f
    }
}

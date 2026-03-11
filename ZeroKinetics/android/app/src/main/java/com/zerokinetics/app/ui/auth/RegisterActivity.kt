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
import com.zerokinetics.app.network.models.RegisterRequest
import com.zerokinetics.app.ui.gesture.GestureEnrollActivity
import com.zerokinetics.app.utils.Validators
import kotlinx.coroutines.launch

class RegisterActivity : AppCompatActivity() {

    private lateinit var etName: TextInputEditText
    private lateinit var etEmail: TextInputEditText
    private lateinit var etPassword: TextInputEditText
    private lateinit var etConfirmPassword: TextInputEditText
    private lateinit var btnRegister: Button
    private lateinit var tvError: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var tvSignIn: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_register)

        etName = findViewById(R.id.etName)
        etEmail = findViewById(R.id.etEmail)
        etPassword = findViewById(R.id.etPassword)
        etConfirmPassword = findViewById(R.id.etConfirmPassword)
        btnRegister = findViewById(R.id.btnRegister)
        tvError = findViewById(R.id.tvError)
        progressBar = findViewById(R.id.progressBar)
        tvSignIn = findViewById(R.id.tvSignIn)

        animateEntrance()

        btnRegister.setOnClickListener { performRegistration() }

        tvSignIn.setOnClickListener {
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
        val title1 = findViewById<View>(R.id.tvRegTitle1)
        val title2 = findViewById<View>(R.id.tvRegTitle2)
        title1.alpha = 0f; title1.translationX = -30f
        title2.alpha = 0f; title2.translationX = -30f

        ObjectAnimator.ofFloat(title1, "alpha", 0f, 1f).apply { duration = 500; start() }
        ObjectAnimator.ofFloat(title1, "translationX", -30f, 0f).apply { duration = 500; start() }
        ObjectAnimator.ofFloat(title2, "alpha", 0f, 1f).apply { duration = 500; startDelay = 150; start() }
        ObjectAnimator.ofFloat(title2, "translationX", -30f, 0f).apply { duration = 500; startDelay = 150; start() }
    }

    private fun performRegistration() {
        val name = etName.text?.toString()?.trim() ?: ""
        val email = etEmail.text?.toString()?.trim() ?: ""
        val password = etPassword.text?.toString() ?: ""
        val confirmPassword = etConfirmPassword.text?.toString() ?: ""


        if (name.isEmpty() || email.isEmpty() || password.isEmpty() || confirmPassword.isEmpty()) {
            showError(getString(R.string.error_fields_required))
            return
        }
        if (!Validators.isValidName(name)) {
            showError("Name must be 1–100 characters")
            return
        }
        if (!Validators.isValidEmail(email)) {
            showError("Invalid email format")
            return
        }
        if (!Validators.isStrongPassword(password)) {
            showError("Password must be 8+ chars with uppercase, lowercase, number, and symbol")
            return
        }
        if (password != confirmPassword) {
            showError(getString(R.string.error_passwords_mismatch))
            return
        }

        setLoading(true)
        hideError()

        val deviceId = RetrofitClient.getDeviceIdManager(this).getDeviceId()
        val api = RetrofitClient.getApiService(this)

        lifecycleScope.launch {
            try {
                val response = api.register(RegisterRequest(name, email, password, deviceId))
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    val tokenManager = RetrofitClient.getTokenManager(this@RegisterActivity)
                    tokenManager.saveTokens(body.accessToken, body.refreshToken)
                    tokenManager.saveUser(body.user.id, body.user.name, body.user.email)


                    startActivity(Intent(this@RegisterActivity, GestureEnrollActivity::class.java))
                    overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
                    finish()
                } else {
                    val errorBody = response.errorBody()?.string()
                    val errorMsg = try {
                        Gson().fromJson(errorBody, ErrorResponse::class.java).error
                    } catch (_: Exception) {
                        getString(R.string.error_unknown)
                    }
                    showError(errorMsg)
                }
            } catch (e: Exception) {
                showError("Network error: ${e.message}")
            } finally {
                setLoading(false)
            }
        }
    }

    private fun showError(message: String) {
        tvError.text = message
        tvError.visibility = View.VISIBLE
    }

    private fun hideError() {
        tvError.visibility = View.GONE
    }

    private fun setLoading(loading: Boolean) {
        progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        btnRegister.isEnabled = !loading
        btnRegister.alpha = if (loading) 0.5f else 1f
    }
}

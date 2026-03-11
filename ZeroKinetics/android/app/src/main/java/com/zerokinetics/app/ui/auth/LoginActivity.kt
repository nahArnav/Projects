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
import com.zerokinetics.app.network.models.LoginRequest
import com.zerokinetics.app.ui.faculty.FacultyDashboardActivity
import com.zerokinetics.app.ui.session.JoinSessionActivity
import com.zerokinetics.app.utils.Validators
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    private lateinit var etEmail: TextInputEditText
    private lateinit var etPassword: TextInputEditText
    private lateinit var btnLogin: Button
    private lateinit var tvError: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var tvCreateAccount: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        etEmail = findViewById(R.id.etEmail)
        etPassword = findViewById(R.id.etPassword)
        btnLogin = findViewById(R.id.btnLogin)
        tvError = findViewById(R.id.tvError)
        progressBar = findViewById(R.id.progressBar)
        tvCreateAccount = findViewById(R.id.tvCreateAccount)


        animateEntrance()

        btnLogin.setOnClickListener { performLogin() }

        tvCreateAccount.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        }


        val tvFacultyRegister = findViewById<TextView>(R.id.tvFacultyRegister)
        tvFacultyRegister?.setOnClickListener {
            startActivity(Intent(this, FacultyRegisterActivity::class.java))
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        }


        btnLogin.setOnTouchListener { v, event ->
            when (event.action) {
                android.view.MotionEvent.ACTION_DOWN -> {
                    v.animate().scaleX(0.96f).scaleY(0.96f).setDuration(100).start()
                }
                android.view.MotionEvent.ACTION_UP, android.view.MotionEvent.ACTION_CANCEL -> {
                    v.animate().scaleX(1f).scaleY(1f).setDuration(100).start()
                }
            }
            false
        }
    }

    private fun animateEntrance() {
        val title1 = findViewById<View>(R.id.tvLoginTitle1)
        val title2 = findViewById<View>(R.id.tvLoginTitle2)
        title1.alpha = 0f; title1.translationX = -30f
        title2.alpha = 0f; title2.translationX = -30f

        ObjectAnimator.ofFloat(title1, "alpha", 0f, 1f).apply { duration = 500; start() }
        ObjectAnimator.ofFloat(title1, "translationX", -30f, 0f).apply { duration = 500; start() }
        ObjectAnimator.ofFloat(title2, "alpha", 0f, 1f).apply { duration = 500; startDelay = 150; start() }
        ObjectAnimator.ofFloat(title2, "translationX", -30f, 0f).apply { duration = 500; startDelay = 150; start() }
    }

    private fun performLogin() {
        val email = etEmail.text?.toString()?.trim() ?: ""
        val password = etPassword.text?.toString() ?: ""


        if (email.isEmpty() || password.isEmpty()) {
            showError(getString(R.string.error_fields_required))
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
                val response = api.login(LoginRequest(email, password, deviceId))
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    val tokenManager = RetrofitClient.getTokenManager(this@LoginActivity)
                    tokenManager.saveTokens(body.accessToken, body.refreshToken)
                    tokenManager.saveUser(body.user.id, body.user.name, body.user.email, body.role ?: "student")


                    val destination = if (body.role == "faculty") {
                        FacultyDashboardActivity::class.java
                    } else {
                        JoinSessionActivity::class.java
                    }

                    startActivity(Intent(this@LoginActivity, destination))
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
                showError(getString(R.string.error_network))
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
        btnLogin.isEnabled = !loading
        btnLogin.alpha = if (loading) 0.5f else 1f
    }
}

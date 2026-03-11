package com.zerokinetics.app.ui.dashboard

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.zerokinetics.app.R
import com.zerokinetics.app.network.RetrofitClient
import com.zerokinetics.app.network.models.LogoutRequest
import com.zerokinetics.app.ui.auth.LoginActivity
import com.zerokinetics.app.ui.session.JoinSessionActivity
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class DashboardActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_dashboard)

        val tvWelcome = findViewById<TextView>(R.id.tvWelcome)
        val tvSessionInfo = findViewById<TextView>(R.id.tvSessionInfo)
        val btnLogout = findViewById<Button>(R.id.btnLogout)

        val tokenManager = RetrofitClient.getTokenManager(this)
        val deviceIdManager = RetrofitClient.getDeviceIdManager(this)


        val userName = tokenManager.userName ?: "User"
        tvWelcome.text = getString(R.string.dashboard_welcome, userName)

        val sdf = SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault())
        val sessionTime = sdf.format(Date())
        tvSessionInfo.text = "Authenticated at: $sessionTime\n" +
                "Device: ${deviceIdManager.getDeviceId().take(8)}...\n" +
                "Email: ${tokenManager.userEmail ?: "—"}"

        btnLogout.setOnClickListener { performLogout() }


        val btnJoinSession = findViewById<Button>(R.id.btnJoinSession)
        btnJoinSession?.setOnClickListener {
            startActivity(Intent(this, JoinSessionActivity::class.java))
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        }


        btnLogout.setOnTouchListener { v, event ->
            when (event.action) {
                android.view.MotionEvent.ACTION_DOWN ->
                    v.animate().scaleX(0.96f).scaleY(0.96f).setDuration(100).start()
                android.view.MotionEvent.ACTION_UP, android.view.MotionEvent.ACTION_CANCEL ->
                    v.animate().scaleX(1f).scaleY(1f).setDuration(100).start()
            }
            false
        }
    }

    private fun performLogout() {
        val tokenManager = RetrofitClient.getTokenManager(this)
        val api = RetrofitClient.getApiService(this)

        lifecycleScope.launch {
            try {
                api.logout(LogoutRequest(tokenManager.refreshToken))
            } catch (_: Exception) {
                // Logout best-effort; clear locally regardless
            }

            tokenManager.clearAll()

            startActivity(Intent(this@DashboardActivity, LoginActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            })
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
            finish()
        }
    }
}

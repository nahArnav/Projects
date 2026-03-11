package com.zerokinetics.app.ui.splash

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.animation.OvershootInterpolator
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.zerokinetics.app.R
import com.zerokinetics.app.network.RetrofitClient
import com.zerokinetics.app.ui.auth.LoginActivity
import com.zerokinetics.app.ui.dashboard.DashboardActivity
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class SplashActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_splash)

        // Initialize RetrofitClient
        RetrofitClient.init(this)

        val title1 = findViewById<View>(R.id.tvSplashTitle1)
        val title2 = findViewById<View>(R.id.tvSplashTitle2)
        val subtitle = findViewById<View>(R.id.tvSplashSubtitle)

        // Start invisible
        title1.alpha = 0f
        title2.alpha = 0f
        subtitle.alpha = 0f
        title1.translationY = 40f
        title2.translationY = 40f

        // Animate in
        lifecycleScope.launch {
            delay(300)

            val anim1 = AnimatorSet().apply {
                playTogether(
                    ObjectAnimator.ofFloat(title1, "alpha", 0f, 1f),
                    ObjectAnimator.ofFloat(title1, "translationY", 40f, 0f)
                )
                duration = 600
                interpolator = OvershootInterpolator(1.2f)
            }

            val anim2 = AnimatorSet().apply {
                playTogether(
                    ObjectAnimator.ofFloat(title2, "alpha", 0f, 1f),
                    ObjectAnimator.ofFloat(title2, "translationY", 40f, 0f)
                )
                duration = 600
                interpolator = OvershootInterpolator(1.2f)
                startDelay = 200
            }

            val anim3 = ObjectAnimator.ofFloat(subtitle, "alpha", 0f, 1f).apply {
                duration = 500
                startDelay = 500
            }

            AnimatorSet().apply {
                playTogether(anim1, anim2, anim3)
                start()
            }

            // Navigate after splash
            delay(2000)

            val tokenManager = RetrofitClient.getTokenManager(this@SplashActivity)
            val destination = if (tokenManager.isLoggedIn()) {
                DashboardActivity::class.java
            } else {
                LoginActivity::class.java
            }

            startActivity(Intent(this@SplashActivity, destination))
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
            finish()
        }
    }
}

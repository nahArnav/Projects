package com.zerokinetics.app.ui.faculty

import android.os.Bundle
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.zerokinetics.app.R
import com.zerokinetics.app.network.RetrofitClient
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class SessionAttendanceActivity : AppCompatActivity() {

    private lateinit var rvAttendance: RecyclerView
    private lateinit var tvSessionInfo: TextView
    private lateinit var tvEmpty: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var adapter: AttendanceAdapter

    private var sessionId: String = ""
    private var isRefreshing = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_session_attendance)

        sessionId = intent.getStringExtra("SESSION_ID") ?: ""

        rvAttendance = findViewById(R.id.rvAttendance)
        tvSessionInfo = findViewById(R.id.tvSessionInfo)
        tvEmpty = findViewById(R.id.tvEmpty)
        progressBar = findViewById(R.id.progressBar)

        tvSessionInfo.text = "Session: $sessionId"

        adapter = AttendanceAdapter()
        rvAttendance.layoutManager = LinearLayoutManager(this)
        rvAttendance.adapter = adapter

        loadAttendance()
        startAutoRefresh()
    }

    private fun loadAttendance() {
        progressBar.visibility = View.VISIBLE
        val api = RetrofitClient.getApiService(this)

        lifecycleScope.launch {
            try {
                val response = api.getSessionAttendance(sessionId)
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (body.attendance.isEmpty()) {
                        tvEmpty.visibility = View.VISIBLE
                        rvAttendance.visibility = View.GONE
                    } else {
                        tvEmpty.visibility = View.GONE
                        rvAttendance.visibility = View.VISIBLE
                        adapter.updateData(body.attendance)
                    }
                }
            } catch (_: Exception) { /* silent */ }
            finally {
                progressBar.visibility = View.GONE
            }
        }
    }

    private fun startAutoRefresh() {
        isRefreshing = true
        lifecycleScope.launch {
            while (isRefreshing) {
                delay(5000)
                if (isRefreshing) loadAttendance()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        isRefreshing = false
    }
}

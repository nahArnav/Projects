package com.zerokinetics.app.network

import com.zerokinetics.app.security.DeviceIdManager
import com.zerokinetics.app.security.NonceGenerator
import com.zerokinetics.app.security.TokenManager
import okhttp3.Interceptor
import okhttp3.Response

/**
 * OkHttp interceptor that injects authentication headers into every request:
 *  - Authorization: Bearer <access_token>
 *  - X-Device-Id: <device_id>
 *  - X-Nonce: <unique_nonce>
 *  - X-Timestamp: <current_timestamp>
 */
class AuthInterceptor(
    private val tokenManager: TokenManager,
    private val deviceIdManager: DeviceIdManager
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()

        val requestBuilder = originalRequest.newBuilder()
            .header("X-Device-Id", deviceIdManager.getDeviceId())
            .header("X-Nonce", NonceGenerator.generateNonce())
            .header("X-Timestamp", NonceGenerator.generateTimestamp())

        // Add JWT if available
        val token = tokenManager.accessToken
        if (token != null) {
            requestBuilder.header("Authorization", "Bearer $token")
        }

        return chain.proceed(requestBuilder.build())
    }
}

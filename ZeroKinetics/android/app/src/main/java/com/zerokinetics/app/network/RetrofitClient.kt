package com.zerokinetics.app.network

import android.content.Context
import com.zerokinetics.app.BuildConfig
import com.zerokinetics.app.security.DeviceIdManager
import com.zerokinetics.app.security.TokenManager
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Singleton Retrofit client configured with:
 *  - Auth interceptor (JWT, device ID, nonce, timestamp)
 *  - Logging interceptor (debug builds only)
 *  - Timeouts for gesture data uploads
 */
object RetrofitClient {

    private var apiService: ApiService? = null
    private var tokenManager: TokenManager? = null
    private var deviceIdManager: DeviceIdManager? = null

    fun init(context: Context) {
        tokenManager = TokenManager(context)
        deviceIdManager = DeviceIdManager(context)
    }

    fun getTokenManager(context: Context): TokenManager {
        if (tokenManager == null) init(context)
        return tokenManager!!
    }

    fun getDeviceIdManager(context: Context): DeviceIdManager {
        if (deviceIdManager == null) init(context)
        return deviceIdManager!!
    }

    fun getApiService(context: Context): ApiService {
        if (apiService == null) {
            val tm = getTokenManager(context)
            val dm = getDeviceIdManager(context)

            val loggingInterceptor = HttpLoggingInterceptor().apply {
                level = if (BuildConfig.DEBUG) {
                    HttpLoggingInterceptor.Level.BODY
                } else {
                    HttpLoggingInterceptor.Level.NONE
                }
            }

            val client = OkHttpClient.Builder()
                .addInterceptor(AuthInterceptor(tm, dm))
                .addInterceptor(loggingInterceptor)
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)      // longer for gesture uploads
                .writeTimeout(60, TimeUnit.SECONDS)
                .build()

            val retrofit = Retrofit.Builder()
                .baseUrl(BuildConfig.API_BASE_URL)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()

            apiService = retrofit.create(ApiService::class.java)
        }
        return apiService!!
    }
}

package com.zerokinetics.app.network

import com.zerokinetics.app.network.models.*
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Retrofit API service interface for ZeroKinetics backend.
 */
interface ApiService {

    @POST("register")
    suspend fun register(@Body request: RegisterRequest): Response<RegisterResponse>

    @POST("register-faculty")
    suspend fun registerFaculty(@Body request: FacultyRegisterRequest): Response<FacultyRegisterResponse>

    @POST("login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @POST("refresh-token")
    suspend fun refreshToken(@Body request: RefreshTokenRequest): Response<TokenRefreshResponse>

    @POST("logout")
    suspend fun logout(@Body request: LogoutRequest): Response<MessageResponse>

    @POST("verify-email")
    suspend fun verifyEmail(@Body body: Map<String, String>): Response<MessageResponse>

    @POST("enroll-gesture")
    suspend fun enrollGesture(@Body request: EnrollGestureRequest): Response<EnrollGestureResponse>

    @POST("verify-gesture")
    suspend fun verifyGesture(@Body request: VerifyGestureRequest): Response<GestureVerifyResponse>



    @POST("create-session")
    suspend fun createSession(@Body request: CreateSessionRequest): Response<CreateSessionResponse>

    @POST("end-session")
    suspend fun endSession(@Body request: EndSessionRequest): Response<MessageResponse>

    @GET("session-status/{sessionId}")
    suspend fun getSessionStatus(@Path("sessionId") sessionId: String): Response<SessionStatusResponse>

    @GET("session-attendance/{sessionId}")
    suspend fun getSessionAttendance(@Path("sessionId") sessionId: String): Response<SessionAttendanceResponse>

    @POST("validate-session")
    suspend fun validateSession(@Body request: ValidateSessionRequest): Response<ValidateSessionResponse>

    @POST("join-session")
    suspend fun joinSession(@Body request: JoinSessionRequest): Response<JoinSessionResponse>
}

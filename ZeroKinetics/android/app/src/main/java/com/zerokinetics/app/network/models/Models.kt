package com.zerokinetics.app.network.models

import com.google.gson.annotations.SerializedName


data class RegisterRequest(
    val name: String,
    val email: String,
    val password: String,
    val deviceId: String
)

data class FacultyRegisterRequest(
    val name: String,
    val email: String,
    val password: String,
    val deviceId: String,
    val facultyCode: String
)

data class LoginRequest(
    val email: String,
    val password: String,
    val deviceId: String
)

data class RefreshTokenRequest(
    val refreshToken: String
)

data class LogoutRequest(
    val refreshToken: String?
)

data class SensorReadingDto(
    val timestamp: Long,
    val ax: Float,
    val ay: Float,
    val az: Float,
    val gx: Float,
    val gy: Float,
    val gz: Float
)

data class GestureSampleDto(
    val data: List<SensorReadingDto>,
    val duration: Long? = null
)

data class EnrollGestureRequest(
    val gestureSamples: List<GestureSampleDto>
)

data class ValidateSessionRequest(
    val sessionId: String
)

data class ValidateSessionResponse(
    val sessionValid: Boolean,
    val wifiSSID: String? = null,
    val wifiBSSID: String? = null,
    val courseName: String? = null,
    val error: String? = null
)

data class VerifyGestureRequest(
    val gestureData: List<SensorReadingDto>,
    val sessionId: String? = null
)

data class CreateSessionRequest(
    val courseName: String,
    val durationMinutes: Int,
    val wifiSSID: String,
    val wifiBSSID: String
)

data class EndSessionRequest(
    val sessionId: String
)

data class JoinSessionRequest(
    val sessionId: String,
    val wifiSSID: String,
    val wifiBSSID: String,
    val gestureData: List<SensorReadingDto>
)

data class UserDto(
    val id: String,
    val name: String,
    val email: String,
    val emailVerified: Boolean? = false
)

data class RegisterResponse(
    val message: String,
    val user: UserDto,
    val role: String? = "student",
    val accessToken: String,
    val refreshToken: String,
    val emailVerificationToken: String? = null
)

data class FacultyRegisterResponse(
    val message: String,
    val role: String,
    val user: UserDto,
    val accessToken: String,
    val refreshToken: String
)

data class LoginResponse(
    val message: String,
    val requiresGesture: Boolean,
    val role: String? = "student",
    val user: UserDto,
    val accessToken: String,
    val refreshToken: String
)

data class TokenRefreshResponse(
    val accessToken: String,
    val refreshToken: String
)

data class GestureVerifyResponse(
    val status: String,
    val confidence: Float,
    val message: String,
    val accessToken: String? = null,
    val refreshToken: String? = null,
    val remainingAttempts: Int? = null,
    val courseName: String? = null,
    val verified: Boolean? = null
) {
    /** Convenience check — true when status is "verified". */
    val isVerified: Boolean get() = verified == true || status == "verified"
}

data class EnrollGestureResponse(
    val message: String,
    val modelId: String? = null,
    val status: String? = null,
    val samplesReceived: Int? = null
)

data class CreateSessionResponse(
    val sessionId: String,
    val courseName: String,
    val startTime: String,
    val endTime: String,
    val wifiSSID: String,
    val status: String
)

data class SessionStatusResponse(
    val sessionId: String,
    val courseName: String,
    val startTime: String,
    val endTime: String,
    val status: String,
    val studentsVerified: Int,
    val wifiSSID: String
)

data class AttendanceEntry(
    val studentName: String,
    val status: String,
    val verificationScore: Float,
    val timestamp: String
)

data class SessionAttendanceResponse(
    val sessionId: String,
    val courseName: String? = null,
    val attendance: List<AttendanceEntry>
)

data class JoinSessionResponse(
    val status: String,
    val message: String,
    val confidence: Float? = null,
    val verified: Boolean? = null
)

data class ErrorResponse(
    val error: String,
    val reason: String? = null
)

data class MessageResponse(
    val message: String
)

package com.zerokinetics.app.sensor

/**
 * A single sensor reading from accelerometer + gyroscope.
 */
data class SensorReading(
    val timestamp: Long,   // System.nanoTime()
    val ax: Float,         // Accelerometer X
    val ay: Float,         // Accelerometer Y
    val az: Float,         // Accelerometer Z
    val gx: Float,         // Gyroscope X
    val gy: Float,         // Gyroscope Y
    val gz: Float          // Gyroscope Z
)

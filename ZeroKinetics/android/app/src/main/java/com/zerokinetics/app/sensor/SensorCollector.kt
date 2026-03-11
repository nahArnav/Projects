package com.zerokinetics.app.sensor

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.withTimeout

/**
 * Collects accelerometer + gyroscope data using Android SensorManager.
 * Records for a fixed time window and returns the raw sensor readings.
 */
class SensorCollector(context: Context) {

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private val gyroscope = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)

    companion object {
        const val DEFAULT_DURATION_MS = 2500L  // 2.5 second gesture window
    }

    /**
     * Record sensor data for [durationMs] milliseconds.
     * Returns a list of fused accelerometer + gyroscope readings.
     */
    suspend fun recordGesture(durationMs: Long = DEFAULT_DURATION_MS): List<SensorReading> {
        val readings = mutableListOf<SensorReading>()

        // Temporary storage for latest sensor values
        var latestAccel = floatArrayOf(0f, 0f, 0f)
        var latestGyro = floatArrayOf(0f, 0f, 0f)
        var hasAccel = false
        var hasGyro = false

        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
                when (event.sensor.type) {
                    Sensor.TYPE_ACCELEROMETER -> {
                        latestAccel = event.values.clone()
                        hasAccel = true
                    }
                    Sensor.TYPE_GYROSCOPE -> {
                        latestGyro = event.values.clone()
                        hasGyro = true
                    }
                }
                // Fuse readings when both sensors have data
                if (hasAccel && hasGyro) {
                    readings.add(
                        SensorReading(
                            timestamp = System.nanoTime(),
                            ax = latestAccel[0],
                            ay = latestAccel[1],
                            az = latestAccel[2],
                            gx = latestGyro[0],
                            gy = latestGyro[1],
                            gz = latestGyro[2]
                        )
                    )
                }
            }

            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }

        // Register listeners at fastest rate
        sensorManager.registerListener(
            listener,
            accelerometer,
            SensorManager.SENSOR_DELAY_FASTEST
        )
        sensorManager.registerListener(
            listener,
            gyroscope,
            SensorManager.SENSOR_DELAY_FASTEST
        )

        // Collect for duration
        delay(durationMs)

        // Cleanup
        sensorManager.unregisterListener(listener)

        return readings
    }

    /**
     * Check if required sensors are available on this device.
     */
    fun areSensorsAvailable(): Boolean {
        return accelerometer != null && gyroscope != null
    }
}

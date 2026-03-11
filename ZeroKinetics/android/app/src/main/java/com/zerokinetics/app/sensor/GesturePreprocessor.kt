package com.zerokinetics.app.sensor

/**
 * Preprocesses raw sensor data for ML inference.
 * Applies normalization and ensures consistent length.
 */
object GesturePreprocessor {

    private const val TARGET_LENGTH = 250  // Fixed number of data points

    /**
     * Normalize and resample gesture data to a fixed length.
     */
    fun preprocess(readings: List<SensorReading>): List<SensorReading> {
        if (readings.isEmpty()) return emptyList()

        // Resample to target length via linear interpolation
        val resampled = resample(readings, TARGET_LENGTH)

        // Normalize each axis to [-1, 1]
        return normalize(resampled)
    }

    private fun resample(readings: List<SensorReading>, targetLen: Int): List<SensorReading> {
        if (readings.size == targetLen) return readings
        if (readings.size < 2) return readings

        val result = mutableListOf<SensorReading>()
        val step = (readings.size - 1).toFloat() / (targetLen - 1)

        for (i in 0 until targetLen) {
            val index = i * step
            val lower = index.toInt().coerceIn(0, readings.size - 2)
            val fraction = index - lower

            val a = readings[lower]
            val b = readings[lower + 1]

            result.add(
                SensorReading(
                    timestamp = lerp(a.timestamp.toFloat(), b.timestamp.toFloat(), fraction).toLong(),
                    ax = lerp(a.ax, b.ax, fraction),
                    ay = lerp(a.ay, b.ay, fraction),
                    az = lerp(a.az, b.az, fraction),
                    gx = lerp(a.gx, b.gx, fraction),
                    gy = lerp(a.gy, b.gy, fraction),
                    gz = lerp(a.gz, b.gz, fraction)
                )
            )
        }
        return result
    }

    private fun normalize(readings: List<SensorReading>): List<SensorReading> {
        if (readings.isEmpty()) return readings

        // Find min/max for each axis
        var axMin = Float.MAX_VALUE; var axMax = Float.MIN_VALUE
        var ayMin = Float.MAX_VALUE; var ayMax = Float.MIN_VALUE
        var azMin = Float.MAX_VALUE; var azMax = Float.MIN_VALUE
        var gxMin = Float.MAX_VALUE; var gxMax = Float.MIN_VALUE
        var gyMin = Float.MAX_VALUE; var gyMax = Float.MIN_VALUE
        var gzMin = Float.MAX_VALUE; var gzMax = Float.MIN_VALUE

        for (r in readings) {
            axMin = minOf(axMin, r.ax); axMax = maxOf(axMax, r.ax)
            ayMin = minOf(ayMin, r.ay); ayMax = maxOf(ayMax, r.ay)
            azMin = minOf(azMin, r.az); azMax = maxOf(azMax, r.az)
            gxMin = minOf(gxMin, r.gx); gxMax = maxOf(gxMax, r.gx)
            gyMin = minOf(gyMin, r.gy); gyMax = maxOf(gyMax, r.gy)
            gzMin = minOf(gzMin, r.gz); gzMax = maxOf(gzMax, r.gz)
        }

        return readings.map { r ->
            SensorReading(
                timestamp = r.timestamp,
                ax = normalizeValue(r.ax, axMin, axMax),
                ay = normalizeValue(r.ay, ayMin, ayMax),
                az = normalizeValue(r.az, azMin, azMax),
                gx = normalizeValue(r.gx, gxMin, gxMax),
                gy = normalizeValue(r.gy, gyMin, gyMax),
                gz = normalizeValue(r.gz, gzMin, gzMax)
            )
        }
    }

    private fun normalizeValue(value: Float, min: Float, max: Float): Float {
        val range = max - min
        return if (range == 0f) 0f else 2f * (value - min) / range - 1f
    }

    private fun lerp(a: Float, b: Float, t: Float): Float = a + (b - a) * t
}

package com.zerokinetics.app.security

import android.content.Context
import android.content.SharedPreferences
import java.util.UUID

/**
 * Generates and persists a unique device ID for device binding.
 * The ID is generated once and stored permanently.
 */
class DeviceIdManager(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("zk_device", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_DEVICE_ID = "device_id"
    }

    /**
     * Get the device ID. Generates one if it doesn't exist yet.
     */
    fun getDeviceId(): String {
        var deviceId = prefs.getString(KEY_DEVICE_ID, null)
        if (deviceId == null) {
            deviceId = UUID.randomUUID().toString()
            prefs.edit().putString(KEY_DEVICE_ID, deviceId).apply()
        }
        return deviceId
    }
}

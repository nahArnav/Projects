package com.zerokinetics.app.utils

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import androidx.core.content.ContextCompat

/**
 * WiFi helper to get current SSID and BSSID for proximity verification.
 * Requires ACCESS_FINE_LOCATION permission on Android 10+.
 */
object WifiHelper {

    data class WifiInfo(
        val ssid: String,
        val bssid: String
    )

    /**
     * Check if location permission is granted (required for WiFi SSID on Android 10+).
     */
    fun hasLocationPermission(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Get the current WiFi SSID and BSSID.
     * Returns null if WiFi is not connected or permission is not granted.
     */
    @Suppress("DEPRECATION")
    fun getCurrentWifi(context: Context): WifiInfo? {
        if (!hasLocationPermission(context)) return null

        val wifiManager = context.applicationContext
            .getSystemService(Context.WIFI_SERVICE) as? WifiManager ?: return null

        val connectionInfo = wifiManager.connectionInfo ?: return null

        var ssid = connectionInfo.ssid ?: return null
        val bssid = connectionInfo.bssid ?: return null

        // Remove surrounding quotes from SSID
        if (ssid.startsWith("\"") && ssid.endsWith("\"")) {
            ssid = ssid.substring(1, ssid.length - 1)
        }

        // Check for unknown SSID
        if (ssid == "<unknown ssid>" || bssid == "02:00:00:00:00:00") {
            return null
        }

        return WifiInfo(ssid = ssid, bssid = bssid)
    }

    /**
     * Check if device is connected to WiFi.
     */
    fun isConnectedToWifi(context: Context): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return false
        val network = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(network) ?: return false
        return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
    }
}

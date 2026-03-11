# ProGuard / R8 rules for ZeroKinetics

# Retrofit
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.zerokinetics.app.network.models.** { *; }
-keep interface com.zerokinetics.app.network.ApiService { *; }
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# Gson
-keep class com.google.gson.** { *; }
-keepattributes EnclosingMethod
-keepattributes InnerClasses

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }

# Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}

# Keep sensor data classes
-keep class com.zerokinetics.app.sensor.** { *; }

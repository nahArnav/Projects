# 🚀 ZeroKinetics

[![Platform](https://img.shields.io/badge/Platform-Android-green.svg)]()
[![Backend](https://img.shields.io/badge/Backend-Node.js-blue.svg)]()
[![ML](https://img.shields.io/badge/ML-TensorFlow%2FPyTorch-orange.svg)]()

> **Gesture-Based Biometric Authentication for Secure Classroom Attendance**

ZeroKinetics is a biometric authentication system that verifies student identity using smartphone motion sensors and machine learning. By analyzing the unique motion patterns of a user's gesture—rather than relying on easily spoofed QR codes, roll calls, or GPS—ZeroKinetics ensures that only the actual student can mark their attendance.

---

## 🎯 The Problem

Traditional attendance systems verify *devices* or *locations*, leaving them vulnerable to exploitation:
* **Proxy Attendance:** Students marking attendance for absent friends.
* **QR Code Sharing:** Scanning forwarded codes outside the classroom.
* **Location Spoofing:** Falsifying GPS coordinates to bypass geofencing.
* **Wasted Time:** Manual roll calls consume valuable lecture time.

## 💡 The Solution

ZeroKinetics verifies the **person**, not just the device. 

By capturing data from a smartphone's Accelerometer and Gyroscope, our 1D CNN Triplet Neural Network learns the unique motion dynamics (speed, rhythm, and jerk) of a student's gesture. Even if an imposter flawlessly mimics the *shape* of the gesture, they cannot replicate the original user's exact motion signature, effectively eliminating proxy attendance.

---

## ⭐ Key Features

* **👤 Gesture Biometrics:** Analyzes raw sensor data to create a highly secure, unique motion signature for every student.
* **🧠 ML-Based Verification:** Generates gesture embeddings via a 1D CNN Triplet model, verifying identity using precise L2 distance matching.
* **📶 WiFi Proximity Lock:** Restricts authentication access strictly to the classroom's local WiFi network.
* **👨‍🏫 Faculty Session Control:** Empowers instructors to generate secure, time-bound session IDs with a real-time monitoring dashboard.
* **🔐 Secure Architecture:** Protects API communication using JWT tokens, replay attack prevention, and session expiration.

---

## 🏗 System Architecture



### Authentication Flow
1. **Initiation:** Faculty creates a secure session and shares the ID.
2. **Pre-check:** Student enters the ID; system verifies classroom WiFi proximity.
3. **Action:** Student performs their registered biometric gesture.
4. **Processing:** Node.js backend routes sensor data to the Python ML service.
5. **Verification:** Model compares the live gesture embedding against the stored database profile.
6. **Result:** Real-time attendance is logged on the faculty dashboard.

---

## 🤖 Machine Learning Pipeline

Our model is designed to verify the *dynamics* of the motion, focusing on 11 distinct features per timestep (including acceleration magnitude, gyroscope data, and jerk).

* **Architecture:** 3-block 1D Convolutional Neural Network (Conv1D ➔ BatchNorm ➔ ReLU ➔ MaxPool).
* **Output:** A 128-dimensional L2-normalized embedding.
* **Verification Logic:** Compares the L2 distance between the incoming gesture embedding and the user's stored centroid embedding against a strict security threshold.

### 📊 Performance

| System Type | Authentication Accuracy |
| :--- | :--- |
| Standard 2D Shape/Pattern Recognition | ~85% |
| **ZeroKinetics (Full Motion Biometrics)** | **95 - 98%** |

---

## 🧰 Technologies Used

* **Mobile Client:** Android (Kotlin), Android Sensor APIs, WiFiManager
* **Backend Services:** Node.js, Express.js, JWT Authentication
* **Machine Learning:** Python, TensorFlow / PyTorch, NumPy, Scikit-learn
* **Database:** MongoDB

---

## 🎥 Demo

[Demo Video](https://drive.google.com/drive/folders/1UPLMxYA3J6JxyhzIcSSoeldWXKD3zAr-)

---

## 🚀 Future Scope

* **Liveness Detection:** To prevent mechanical/robotic spoofing.
* **On-Device Inference:** Migrating the ML model to the edge (TensorFlow Lite) for offline verification.

---

**Built with ❤️ for AMD Slingshot by Team Kernel Panics** *Project: ZeroKinetics*

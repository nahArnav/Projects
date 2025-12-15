//INCLUDES
#include <WiFi.h>
#include <ESP32Servo.h>
#include <ESPAsyncWebServer.h>

/*---Pin Definitions---*/

//MOTOR1
#define in1 32
#define in2 33
#define enA 25

//MOTOR2
#define in3 26
#define in4 27
#define enB 13

//SERVO
#define servoPin 14
#define MotSpeed 180


short unsigned int control;
bool ispick = true;

const char* ssid = "";  //Your Wifi name
const char* password = "";  //Wifi password

//OBJECT
Servo servo;
AsyncWebServer server(80);


//function declarations
void forward();
void backward();
void left();
void right();
void stopBot();
void pick();
void keep();


void setup() {
  // put your setup code here, to run once:
  pinMode(in1, OUTPUT);
  pinMode(in2, OUTPUT);
  pinMode(in3, OUTPUT);
  pinMode(in4, OUTPUT);
  pinMode(enA, OUTPUT);
  pinMode(enB, OUTPUT);
  control = 0;
  Serial.begin(115200);
  
  /*Code to establish connection to wifi*/
  Serial.println("Connecting to Wifi...");
  WiFi.begin(ssid, password);
  
  // WIFI CONNECTION ATTEMPTS
  int attempts = 0;
  while(WiFi.status() != WL_CONNECTED && attempts < 20){
    delay(1000);
    Serial.print(".");
    attempts++;
  }

  //Code after wifi is connected 
  if(WiFi.status() == WL_CONNECTED)
  {
    Serial.println("\nConnected to WiFi");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());

    //here we are defining the requests that make changes to control variable
    server.on("/forward", HTTP_GET, [](AsyncWebServerRequest *request){
      Serial.println("Forward");
      control = 1;
      request -> send(200, "text/plain", "Moving Forward");

    });
    server.on("/left", HTTP_GET, [](AsyncWebServerRequest *request){
      Serial.println("Left");
      control = 2;
      request -> send(200, "text/plain", "Moving Left");

    });
    server.on("/right", HTTP_GET, [](AsyncWebServerRequest *request){
      Serial.println("Right");
      control = 3;
      request -> send(200, "text/plain", "Moving Right");

    });
    server.on("/back", HTTP_GET, [](AsyncWebServerRequest *request){
      Serial.println("Back");
      control = 4;
      request -> send(200, "text/plain", "Moving Backward");

    });
    server.on("/stop", HTTP_GET, [](AsyncWebServerRequest *request){
      Serial.println("Stop");
      control = 5;
      request -> send(200, "text/plain", "Stop");


    });
    server.on("/pinch", HTTP_GET, [](AsyncWebServerRequest *request){
      if(ispick == true){
        ispick = false;
        control = 6;
        Serial.println("picked!");
        request->send(200, "text/plain", "Picked");
      }
      else
        ispick = true;
        control = 7;
        Serial.println("kept!");
        request->send(200, "text/plain", "kept!");


    });

    //SERVER BEGIN
    server.begin();
    Serial.println("Server Started");

  }
  else
  {
    Serial.println("\nFailed to connect to WiFi");
  }
}

void loop() {
  // put your main code here, to run repeatedly:
 
  switch (control) {
    case 1: forward(); delay(50); break;
    case 2: left(); delay(50); break;
    case 3: right(); delay(50); break;
    case 4: backward(); delay(50); break;
    case 5: stopBot(); delay(50); break;
    case 6: pick(); delay(50); break;
    case 7: keep(); delay(50); break;

    case 0://idle case 
    default: Serial.println("Skill Issue"); break;
  }
delay(10);
}


void forward() {
  digitalWrite(in1, HIGH);
  digitalWrite(in2, LOW);
  digitalWrite(in3, HIGH);
  digitalWrite(in4, LOW);
  analogWrite(enA, MotSpeed);
  analogWrite(enB, MotSpeed);


}

void backward() {
  digitalWrite(in1, LOW);
  digitalWrite(in2, HIGH);
  digitalWrite(in3, LOW);
  digitalWrite(in4, HIGH);
  analogWrite(enA, MotSpeed);
  analogWrite(enB, MotSpeed);


}

void right() {
  digitalWrite(in1, LOW);
  digitalWrite(in2, HIGH);
  digitalWrite(in3, HIGH);
  digitalWrite(in4, LOW);
  analogWrite(enA, MotSpeed);
  analogWrite(enB, MotSpeed);

}

void left() {
  digitalWrite(in1, HIGH);
  digitalWrite(in2, LOW);
  digitalWrite(in3, LOW);
  digitalWrite(in4, HIGH);
  analogWrite(enA, MotSpeed);
  analogWrite(enB, MotSpeed);

}

void stopBot() {
  digitalWrite(in1, LOW);
  digitalWrite(in2, LOW);
  digitalWrite(in3, LOW);
  digitalWrite(in4, LOW);
  analogWrite(enA, 0);
  analogWrite(enB, 0);

}

void pick(){
  servo.write(90);
  delay(1000);
  control = 0;

}

void keep(){

  servo.write(-90);
  delay(1000);
  control = 0;
}

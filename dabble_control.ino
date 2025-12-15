//Include Libraries

#define CUSTOM_SETTINGS
#define INCLUDE_GAMEPAD_MODULE 
#include<DabbleESP32.h>
#include<ESP32Servo.h>

//PIN DEFINITIONS

//Motor 1
#define in1 32
#define in2 33
#define en1 25

//Motor 2
#define in3 26
#define in4 27
#define en2 13

//SERVO
Servo myservo;
#define an1 14

int i = 0;

//Function to set the motor speed and direction
void setMotors(int inA, int inB, int pwm, int speed)
{
  if(speed > 0){
    digitalWrite(inA, HIGH);
    digitalWrite(inB, LOW);
    analogWrite(pwm, speed);
  }
  else if(speed < 0){
    digitalWrite(inB, HIGH);
    digitalWrite(inA, LOW);
    analogWrite(pwm, -speed);
  }
  else{
    digitalWrite(inA, LOW);
    digitalWrite(inB, LOW);
    analogWrite(pwm, 0);
  }
}


//Setup Function
void setup() {
  //Begins for setup
  Serial.begin(115200);
  Dabble.begin("Oy Pols Agyi Pols");
  Serial.println("Dabble is Ready");

  //pinModes
  pinMode (in1, OUTPUT);
  pinMode (in2, OUTPUT);
  pinMode (en1, OUTPUT);
  pinMode (in3, OUTPUT);
  pinMode (in4, OUTPUT);
  pinMode (en2, OUTPUT);

  //servo
  pinMode(an1, OUTPUT);
  myservo.attach(an1);
}



void loop() {
  //Dabble input
  Dabble.processInput();

  //Gamepad inputs
  int x_value = GamePad.getXaxisData();
  int y_value = GamePad.getYaxisData();
  int r_value = GamePad.getRadius();
  int a_value = GamePad.getAngle();
  
  //speed
  int speed = map(r_value, 0, 7, 0, 255);

  //if-else block for loco control
  if(a_value == 0 && x_value == 0 && y_value == 0){
    Serial.println("Stop");
    setMotors(in1, in2, en1, 0);
    setMotors(in3, in4, en2, 0);
  }
  else if(a_value > 45 && a_value <= 135){
    Serial.println("Forward");
    setMotors(in1, in2, en1, -speed);
    setMotors(in3, in4, en2, -speed);
  }
  else if(a_value > 135 && a_value <= 225){
    Serial.println("Left");
    setMotors(in1, in2, en1, -speed);
    setMotors(in3, in4, en2, speed);
  }
  else if(a_value > 225 && a_value <= 315){
    Serial.println("Backward");
    setMotors(in1, in2, en1, speed);
    setMotors(in3, in4, en2, speed);
  }
  else {
    Serial.println("Right");
    setMotors(in1, in2, en1, speed);
    setMotors(in3, in4, en2, -speed);
  }

  //servo control
  if(GamePad.isCirclePressed()){
    Serial.println("Circle Pressed");
    for(int i = 45; i <= 95; i++){
      myservo.write(i);
      delay(10);
    }
  }
  if(GamePad.isTrianglePressed()){
    Serial.println("Triangle Pressed");
    for(int i = 95; i >= 45; i--){
      myservo.write(i);
      delay(10);
    }
  }


}
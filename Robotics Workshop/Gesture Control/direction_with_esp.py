#IMPORTS
import cv2
import mediapipe as mp
import time
import requests

# ESP32 Web Server IP
ESP_IP = 'http://'

# Initialize Mediapipe
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(max_num_hands = 1, min_detection_confidence = 0.7)
mp_draw = mp.solutions.drawing_utils
# Open webcam
cap = cv2.VideoCapture(0)
cap.set(3, 640)
cap.set(4,480)

# Timing and gesture state
last_action_time = time.time()
cooldown = 0.3 #seconds between actions
picked = False
prev_pinch = False
last_action = "None"

# Functions
def calculate_distance(p1, p2):
    return((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2) **0.5


def send_to_esp(endpoint):
    """Send HTTP command to ESP32 (with short timeout)."""
    try:
        url = f"{ESP_IP}/{endpoint}"
        requests.get(url, timeout = 0.3)
        print(f"Sent to ESP32: {endpoint}")
    except requests.exceptions.RequestException:
        print(f"Failed to send to ESP32: {endpoint}")



# WHILE LOOP FOR ALL LOGIC
while True:
    success, img = cap.read()
    # CV success verification
    if not success:
        break

    # CV window config
    img = cv2.flip(img, 1)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    results = hands.process(img_rgb)
    h, w, _ = img.shape
    # action var
    current_action = last_action

    # logic block
    if results.multi_hand_landmarks:
        for handLms in results.multi_hand_landmarks:
            mp_draw.draw_landmarks(img, handLms, mp_hands.HAND_CONNECTIONS)
            index_tip = handLms.landmark[mp_hands.HandLandmark.INDEX_FINGER_TIP]
            thumb_tip = handLms.landmark[mp_hands.HandLandmark.THUMB_TIP]

            x, y = int(index_tip.x * w), int(index_tip.y * h)
            thumb_x, thumb_y = int(thumb_tip.x * w), int(thumb_tip.y*h)

            cv2.circle(img, (x,y),10, (0,255,0), cv2.FILLED)
            cv2.circle(img, (thumb_x, thumb_y), 10, (255,0,0), cv2.FILLED)

            dist = calculate_distance((x,y), (thumb_x, thumb_y))
            pinch = dist < 40

            
            current_time = time.time()
            if current_time - last_action_time > cooldown:

                # Grid boundaries
                left_limit = w // 3
                right_limit = 2*w//3
                top_limit = h//3
                bottom_limit=2*h//3
                in_top = y < top_limit
                in_middle = top_limit < y < bottom_limit
                in_bottom = y > bottom_limit
                in_left = x < left_limit
                in_center = left_limit < x < right_limit
                in_right = x > right_limit


                
                # Pick / Drop (center-middle zone)
                if pinch and not prev_pinch and in_center and in_middle:
                    if not picked:
                        current_action = "Pick"
                        picked = True
                    else:
                        current_action = "Drop"
                        picked = False
                elif not pinch:
                    if in_top:
                        current_action = "Move Forward"
                    elif in_bottom:
                        current_action = "Move Backward"
                    elif in_middle:
                        if in_left:
                            current_action = "Move Left"
                        elif in_right:
                            current_action = "Move Right"  
                        else:
                            current_action = "None"
                prev_pinch = pinch
                last_action_time = current_time


    else:
        current_action = "None"

    # Only send if action changes
    if current_action != last_action:
        if current_action == "Move Forward":
            send_to_esp("forward")
        elif current_action == "Move Backward":
            send_to_esp("back")
        elif current_action == "Move Left":
            send_to_esp("left")
        elif current_action == "Move Right":
            send_to_esp("right")
        elif current_action == "Pick":
            send_to_esp("pinch")
        elif current_action == "Drop":
            send_to_esp("pinch")
        elif current_action == "None":
            send_to_esp("stop")
        else:
            send_to_esp("stop")

    last_action = current_action

    # Draw grid
    cv2.line(img, (w//3,0), (w//3,h), (255,255,255),2)
    cv2.line(img, (2*w//3,0), (2*w//3,h), (255,255,255),2)
    cv2.line(img, (0,h//3), (w,h//3), (255,255,255),2)
    cv2.line(img, (0,2*h//3), (w,2*h//3), (255,255,255),2)



    
    # Show current action
    cv2.putText(img, f'Action: {current_action}', (10,40), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,255,255),2)
    # Show image
    cv2.imshow("Gesture -> ESP32 Control", img)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break






# DESTROY
cap.release()
cv2.destroyAllWindows()

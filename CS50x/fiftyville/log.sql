-- Keep a log of any SQL queries you execute as you solve the mystery.
.table
.schema crime_scene_reports

--Date of Robbery = 28th July 2025 At Humphrey Street at 10:15 am
--Description:
--Theft of the CS50 duck took place at 10:15am at the Humphrey Street bakery.
--Interviews were conducted today with three witnesses who were present at the time – each of their interview transcripts mentions the bakery

--CHECKING INTERVIEWS
.schema interviews
SELECT name, transcript FROM interviews WHERE year = 2025 AND month = 7 AND day = 28 AND transcript LIKE '%bakery%';
--| Ruth    | Sometime within ten minutes of the theft, I saw the thief get into a car in the bakery parking lot and drive away.
--If you have security footage from the bakery parking lot, you might want to look for cars that left the parking lot in that time frame.
--| Eugene  | I don't know the thief's name, but it was someone I recognized. Earlier this morning, before I arrived at Emma's bakery, I was walking by
--the ATM on Leggett Street and saw the thief there withdrawing some money.
--| Raymond | As the thief was leaving the bakery, they called someone who talked to them for less than a minute. In the call, I heard the thief say
--that they were planning to take the earliest flight out of Fiftyville tomorrow. The thief then asked the person on the other end of the phone
--to purchase the flight ticket.
--from this we can conclude that whoever the thief was talking to on the phone is his accomplice

--CHECKING BAKERY SECURITY LOGS
.schema bakery_security_logs
SELECT hour, minute, license_plate, activity FROM bakery_security_logs WHERE year = 2025 AND month = 7 AND day = 28 AND hour = 10;
--+------+--------+---------------+----------+
--| hour | minute | license_plate | activity |
--+------+--------+---------------+----------+
--| 10   | 8      | R3G7486       | entrance |
--| 10   | 14     | 13FNH73       | entrance |
--| 10   | 16     | 5P2BI95       | exit     |
--| 10   | 18     | 94KL13X       | exit     |
--| 10   | 18     | 6P58WS2       | exit     |
--| 10   | 19     | 4328GD8       | exit     |
--| 10   | 20     | G412CB7       | exit     |
--| 10   | 21     | L93JTIZ       | exit     |
--| 10   | 23     | 322W7JE       | exit     |
--| 10   | 23     | 0NTHK55       | exit     |
--| 10   | 35     | 1106N58       | exit     |
--| 10   | 42     | NRYN856       | entrance |
--| 10   | 44     | WD5M8I6       | entrance |
--| 10   | 55     | V47T75I       | entrance |
--+------+--------+---------------+----------+
--the thief used one of the cars that exit before 10:25

--CHECKING ATM TRANSACTIONS
.schema atm_transactions
SELECT account_number, amount, transaction_type FROM atm_transactions  WHERE year = 2025 AND month = 7 AND day = 28 AND atm_location = 'Leggett Street';
--+----------------+--------+------------------+
--| account_number | amount | transaction_type |
--+----------------+--------+------------------+
--| 28500762       | 48     | withdraw         |
--| 28296815       | 20     | withdraw         |
--| 76054385       | 60     | withdraw         |
--| 49610011       | 50     | withdraw         |
--| 16153065       | 80     | withdraw         |
--| 86363979       | 10     | deposit          |
--| 25506511       | 20     | withdraw         |
--| 81061156       | 30     | withdraw         |
--| 26013199       | 35     | withdraw         |
--+----------------+--------+------------------+

--CHECKING PHONE CALLS
.schema phone_calls
SELECT caller, receiver, duration FROM phone_calls  WHERE year = 2025 AND month = 7 AND day = 28 AND duration < 60;
--+----------------+----------------+----------+
--|     caller     |    receiver    | duration |
--+----------------+----------------+----------+
--| (130) 555-0289 | (996) 555-8899 | 51       |
--| (499) 555-9472 | (892) 555-8872 | 36       |
--| (367) 555-5533 | (375) 555-8161 | 45       |
--| (499) 555-9472 | (717) 555-1342 | 50       |
--| (286) 555-6063 | (676) 555-6554 | 43       |
--| (770) 555-1861 | (725) 555-3243 | 49       |
--| (031) 555-6622 | (910) 555-3251 | 38       |
--| (826) 555-1652 | (066) 555-9701 | 55       |
--| (338) 555-6650 | (704) 555-2131 | 54       |
--+----------------+----------------+----------+
--one of these calls was made by the thief


--CHECKING FLIGHTS
.schema flights
SELECT id, origin_airport_id, destination_airport_id, hour, minute FROM flights where year= 2025 AND day = 29 AND month = 7 AND origin_airport_id in(
    SELECT id FROM airports WHERE city = 'Fiftyville'
) ORDER BY hour, minute;
--+----+-------------------+------------------------+------+--------+
--| id | origin_airport_id | destination_airport_id | hour | minute |
--+----+-------------------+------------------------+------+--------+
--| 36 | 8                 | 4                      | 8    | 20     |
--| 43 | 8                 | 1                      | 9    | 30     |
--| 23 | 8                 | 11                     | 12   | 15     |
--| 53 | 8                 | 9                      | 15   | 20     |
--| 18 | 8                 | 6                      | 16   | 0      |
--+----+-------------------+------------------------+------+--------+
--+-------------------+------------------------+------+--------+
--The thief took the first flight from fiftyville to NEW YORK CITY

--CHECKING FOR PASSENGERS
.schema passengers
.schema people
SELECT id, name, license_plate, passport_number, phone_number FROM people WHERE phone_number in (
    SELECT caller FROM phone_calls  WHERE year = 2025 AND month = 7 AND day = 28 AND duration < 60
) AND license_plate in (
    SELECT license_plate FROM bakery_security_logs WHERE year = 2025 AND month = 7 AND day = 28 AND hour = 10 AND minute < 25 AND activity = 'exit'
) AND passport_number in (
    SELECT passport_number FROM passengers WHERE flight_id = 36
) AND id in (
    SELECT person_id FROM bank_accounts WHERE account_number in (
        SELECT account_number FROM atm_transactions  WHERE year = 2025 AND month = 7 AND day = 28 AND atm_location = 'Leggett Street' AND transaction_type = 'withdraw'
    )
);
--+--------+-------+---------------+-----------------+----------------+
--|   id   | name  | license_plate | passport_number |  phone_number  |
--+--------+-------+---------------+-----------------+----------------+
--| 686048 | Bruce | 94KL13X       | 5773159633      | (367) 555-5533 |
--+--------+-------+---------------+-----------------+----------------+
--BRUCE IS THE CULPRIT

--TO FIND ACCOMPLICE CHECKING PHONE CALLS
SELECT id, name, license_plate, passport_number, phone_number FROM people WHERE phone_number = (
    SELECT receiver FROM phone_calls  WHERE year = 2025 AND month = 7 AND day = 28 AND duration < 60 AND caller = '(367) 555-5533'
);
--+--------+-------+---------------+-----------------+----------------+
--|   id   | name  | license_plate | passport_number |  phone_number  |
--+--------+-------+---------------+-----------------+----------------+
--| 864400 | Robin | 4V16VO0       | NULL            | (375) 555-8161 |
--+--------+-------+---------------+-----------------+----------------+

--THE ACCOMPLICE OF THE THIEF IS ROBIN

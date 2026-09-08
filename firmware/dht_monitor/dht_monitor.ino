#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <DHT.h>

// NodeMCU D5 = GPIO14. DHT11 module: + -> 3V3, - -> GND, S -> D5.
DHT dht(D5, DHT11);
void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_OFF);
  dht.begin();
  delay(2000);
}
void loop() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) {
    Serial.println("{\"ok\":false,\"error\":\"DHT_READ_FAILED\"}");
  } else {
    Serial.printf("{\"ok\":true,\"temperature\":%.1f,\"humidity\":%.1f,\"uptime_ms\":%lu}\n", t, h, millis());
  }
  delay(2500);
}

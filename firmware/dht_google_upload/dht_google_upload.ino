#include <Arduino.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266WiFi.h>
#include <WiFiClientSecureBearSSL.h>
#include <DHT.h>
#include "secrets.local.h"

DHT dht(D5, DHT11);
const unsigned long UPLOAD_INTERVAL_MS = 60000UL;
unsigned long lastUploadStarted = 0;
bool firstUpload = true;

bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  const unsigned long deadline = millis() + 20000UL;
  while (WiFi.status() != WL_CONNECTED && static_cast<long>(deadline - millis()) > 0) {
    delay(250);
  }
  return WiFi.status() == WL_CONNECTED;
}

void uploadReading() {
  const float humidity = dht.readHumidity();
  const float temperature = dht.readTemperature();
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("DHT_READ_FAILED");
    return;
  }
  if (!connectWiFi()) {
    Serial.println("WIFI_CONNECT_FAILED");
    return;
  }

  BearSSL::WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;
  https.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  if (!https.begin(client, GOOGLE_SCRIPT_URL)) {
    Serial.println("HTTPS_BEGIN_FAILED");
    return;
  }
  https.addHeader("Content-Type", "application/json");
  const String body = "{\"api_key\":\"" + String(DEVICE_API_KEY) +
                      "\",\"device_id\":\"esp8266-01\",\"temperature\":" + String(temperature, 1) +
                      ",\"humidity\":" + String(humidity, 1) +
                      ",\"rssi\":" + String(WiFi.RSSI()) + "}";
  const int status = https.POST(body);
  Serial.printf("UPLOAD_STATUS=%d temperature=%.1f humidity=%.1f\n", status, temperature, humidity);
  https.end();
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  delay(2000);
}

void loop() {
  const unsigned long now = millis();
  if (firstUpload || now - lastUploadStarted >= UPLOAD_INTERVAL_MS) {
    firstUpload = false;
    lastUploadStarted = now;
    uploadReading();
  }
  delay(50);
}

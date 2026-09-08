#include <Arduino.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266WiFi.h>
#include <WiFiClientSecureBearSSL.h>
#include <DHT.h>
#include "secrets.local.h"

DHT dht(D5, DHT11);

void setup() {
  Serial.begin(115200);
  dht.begin();
  delay(2000);

  const float humidity = dht.readHumidity();
  const float temperature = dht.readTemperature();
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("DHT_READ_FAILED");
    ESP.deepSleep(SLEEP_MINUTES * 60ULL * 1000000ULL);
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  const unsigned long deadline = millis() + 20000;
  while (WiFi.status() != WL_CONNECTED && millis() < deadline) delay(250);

  if (WiFi.status() == WL_CONNECTED) {
    BearSSL::WiFiClientSecure client;
    client.setInsecure();  // Apps Script 憑證會更新；傳輸仍使用 TLS，但未固定驗證憑證。
    HTTPClient https;
    https.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    if (https.begin(client, GOOGLE_SCRIPT_URL)) {
      https.addHeader("Content-Type", "application/json");
      String body = "{\"api_key\":\"" + String(DEVICE_API_KEY) +
                    "\",\"device_id\":\"esp8266-01\",\"temperature\":" + String(temperature, 1) +
                    ",\"humidity\":" + String(humidity, 1) +
                    ",\"rssi\":" + String(WiFi.RSSI()) + "}";
      const int status = https.POST(body);
      Serial.printf("UPLOAD_STATUS=%d\n", status);
      https.end();
    }
  } else {
    Serial.printf("WIFI_CONNECT_FAILED status=%d\n", WiFi.status());
    bool targetVisible = false;
    const int count = WiFi.scanNetworks();
    for (int i = 0; i < count; ++i) {
      if (WiFi.SSID(i) == WIFI_SSID) {
        targetVisible = true;
        Serial.printf("TARGET_VISIBLE=YES RSSI=%d CHANNEL=%d\n", WiFi.RSSI(i), WiFi.channel(i));
        break;
      }
    }
    if (!targetVisible) Serial.println("TARGET_VISIBLE=NO (ESP8266 supports 2.4 GHz only)");
    WiFi.scanDelete();
  }

  WiFi.disconnect(true);
  ESP.deepSleep(SLEEP_MINUTES * 60ULL * 1000000ULL);
}

void loop() {}

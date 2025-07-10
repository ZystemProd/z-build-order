import requests

# Path to your test replay
REPLAY_PATH = r"C:\Users\Mattias Viklund\Documents\GitHub\z-build-order\replay\replaytest3.SC2Replay"

# The local endpoint
URL = "http://localhost:5000/upload"

# Prepare the file payload
with open(REPLAY_PATH, "rb") as f:
    files = {'replay': f}
    response = requests.post(URL, files=files)

print(f"✅ Status code: {response.status_code}")
print("✅ Response:")
print(response.text)
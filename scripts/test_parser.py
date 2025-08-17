import requests

# Path to your test replay
REPLAY_PATH = r"C:\Users\Mattias Viklund\Documents\GitHub\z-build-order\replay\replaytest6.SC2Replay"

# The local endpoint
URL = "http://localhost:5000/upload"

# Pick your player
# Use PID (1 or 2) or exact name from the replay
data = {'player': '1'}  # 👈 Change this to '1', '2', or a name

# Prepare the file payload
with open(REPLAY_PATH, "rb") as f:
    files = {'replay': f}
    response = requests.post(URL, files=files, data=data)  # ✅ Now passes player too!

print(f"✅ Status code: {response.status_code}")
print("✅ Response:")
print(response.text)

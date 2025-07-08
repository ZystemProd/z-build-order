import requests

with open(r"C:\Users\Mattias Viklund\Documents\GitHub\z-build-order\replay\replaytest2.SC2Replay", "rb") as f:
    files = {"replay": f}
    response = requests.post("http://localhost:5000/upload", files=files)

print(response.status_code)
print(response.text)

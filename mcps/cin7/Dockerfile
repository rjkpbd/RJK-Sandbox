FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY cin7_mcp_server.py .

ENV PORT=8080
EXPOSE 8080

CMD ["python", "cin7_mcp_server.py"]

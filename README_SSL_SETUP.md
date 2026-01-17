# SSL Certificate Setup for WebXR Robot Camera Streaming

This guide explains how to create self-signed SSL certificates to enable HTTPS for your WebRTC camera server, which is required for WebXR functionality on VR headsets like the Meta Quest 3.

## Why SSL Certificates Are Needed

- **WebXR Requirement**: VR browsers require HTTPS to access WebXR APIs
- **Security**: Modern browsers restrict camera/microphone access to secure contexts
- **Quest 3 Compatibility**: Meta Quest browser enforces HTTPS for WebXR features

## Prerequisites

- OpenSSL installed (comes with macOS by default)
- Terminal access
- Your local IP address (find with `ifconfig | grep "inet "`)

## Step 1: Create Certificate Directory

```bash
# Navigate to your project directory

# Create directory for SSL certificates
mkdir ssl_cert
cd ssl_cert
```

## Step 2: Generate Private Key

```bash
# Generate a 2048-bit RSA private key
openssl genrsa -out server.key 2048
```

This creates `server.key` - keep this file secure and never share it.

## Step 3: Generate Self-Signed Certificate

```bash
# Generate self-signed certificate directly (replace 192.168.1.100 with your actual local IP)
openssl req -new -x509 -key server.key -out server.crt -days 365 -subj "/CN=192.168.1.100"
```

**⚠️ Critical**: Replace `192.168.1.100` with your actual local IP address that the Quest 3 will use to connect. Find it with:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Note**: This single command creates a self-signed certificate valid for 365 days without needing a separate CSR file.

## Step 4: Optional - Create Combined PEM File

```bash
# Some applications prefer a combined certificate+key file
cat server.crt server.key > server.pem
```

## Step 5: Verify Certificate Files

Your `ssl_cert` directory should now contain:
```
ssl_cert/
├── server.key    # Private key (keep secure)
├── server.crt    # Public certificate
└── server.pem    # Combined file (optional)
```

Check the certificate details:
```bash
# View certificate information
openssl x509 -in server.crt -text -noout
```

## Step 6: Update File Permissions

```bash
# Secure the private key
chmod 600 server.key

# Make certificate readable
chmod 644 server.crt
```

## File Descriptions

| File | Description | Keep Secure? |
|------|-------------|--------------|
| `server.key` | Private key used for encryption | ⚠️ YES - Never share |
| `server.crt` | Public certificate that browsers verify | No - Safe to share |
| `server.pem` | Combined cert+key file | ⚠️ YES - Contains private key |

## Testing the Certificate

Test that your certificate works:

```bash
# Test with OpenSSL
openssl s_client -connect YOUR_IP:8765 -servername YOUR_IP

# Test with curl (will show certificate warning)
curl -k https://YOUR_IP:8765/cameras
```

## Using with Quest 3

1. **Start your HTTPS server** with the certificates
2. **Open Quest 3 browser**
3. **Navigate to `https://YOUR_IP:8765`**
4. **Accept security warning**:
   - Click "Advanced"
   - Click "Proceed to YOUR_IP (unsafe)"
5. **The WebXR "Enter VR" button should now be enabled**

## Troubleshooting

### Certificate Not Trusted Error
- **Expected behavior** - self-signed certificates always show warnings
- **Solution**: Click "Advanced" → "Proceed anyway" in browser
- **Alternative**: Install certificate in Quest 3 system settings

### WebXR Still Not Working
- Verify you're using `https://` not `http://`
- Check that Common Name matches your IP address
- Ensure Quest 3 WebXR is enabled in browser settings
- Try restarting Quest browser after accepting certificate

### Wrong IP Address in Certificate
- If your IP changed, regenerate certificate with new IP
- The Common Name in the certificate MUST match the URL you access

### Certificate Expired
```bash
# Check expiration date
openssl x509 -in server.crt -noout -enddate

# Regenerate if expired (replace YOUR_IP_HERE with your actual IP)
openssl req -new -x509 -key server.key -out server.crt -days 365 -subj "/CN=YOUR_IP_HERE"
```

## Security Notes

- **Self-signed certificates** are safe for local development
- **Don't use in production** - get proper certificates from a CA
- **Keep `server.key` secure** - never commit to version control
- **Regenerate certificates** if private key is compromised

## Certificate Renewal

Certificates expire after 365 days. To renew:

```bash
cd ssl_cert

# Generate new certificate directly (replace YOUR_IP_HERE with your actual IP)
openssl req -new -x509 -key server.key -out server.crt -days 365 -subj "/CN=YOUR_IP_HERE"
```

## Next Steps

After creating certificates:
1. ✅ Update your `webrtc_camera_server.py` to use HTTPS
2. ✅ Test with Quest 3 browser
3. ✅ Enable WebXR and enjoy VR robot control!

For implementation details, see the main project documentation.
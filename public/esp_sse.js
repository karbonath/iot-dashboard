let espEndpoint;
let eventSource = null;

const espStatus = document.getElementById('espStatus');
const connectBtn = document.getElementById('connectBtn');

function connectToESP32() {
    updateConnectionStatus(!espStatus.classList.contains('hidden'));
}

// function connectToESP32() {
//   console.log(`Connecting to ESP32 at ${espEndpoint}`);
  
//   // Close existing connection if any
//   if (eventSource) {
//     eventSource.close();
//   }
  
//   try {
//     eventSource = new EventSource(espEndpoint);
    
//     // Connection opened
//     eventSource.addEventListener('open', function() {
//       console.log("✓ Connected to ESP32");
//       updateConnectionStatus(true);
//     });
    
//     // Receive sensor events
//     eventSource.addEventListener('message', function(event) {
//       console.log("📊 Sensor event:", event.data);
//       handleSensorEvent(event.data);
//     });
    
//     // Connection errors
//     eventSource.addEventListener('error', function() {
//       console.error("✗ Connection error");
//       updateConnectionStatus(false);
//       // Browser automatically attempts reconnection
//     });
    
//   } catch (error) {
//     console.error("Failed to create EventSource:", error);
//     updateConnectionStatus(false);
//   }
// }

function handleSensorEvent(eventData) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${eventData}`);
  
  // Update your dashboard UI here
  // Examples:
  // - Increment/decrement counter
  // - Log the event
  // - Update LED indicator
  // - etc.
  
  if (eventData === 'ENTER') {
    console.log("👤 Person entered");
    // Call your existing dashboard functions
  } else if (eventData === 'EXIT') {
    console.log("👤 Person left");
    // Call your existing dashboard functions
  }
}

function updateConnectionStatus(connected) {
  // Update your UI to show connection status
  console.log(connected ? "Connected to ESP32" : "Disconnected from ESP32");

  espStatus.classList.toggle('hidden');

  if (connected) {
    connectBtn.innerHTML = '<i class="fa-solid fa-unlink"></i> Disconnect';
    connectBtn.className = '<bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105';
  } else {
    connectBtn.innerHTML = '<i class="fa-solid fa-link"></i> Connect';
    connectBtn.className = 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105';
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', function() {
  connectToESP32();
});

// Handle page visibility - reconnect if tab was hidden
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible' && eventSource?.readyState !== EventSource.OPEN) {
    console.log("Page visible, reconnecting to ESP32...");
    connectToESP32();
  }
});

// Optional: Cleanup on page unload
window.addEventListener('beforeunload', function() {
  if (eventSource) {
    eventSource.close();
  }
});
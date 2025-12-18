 // Namespace for app state and functions
  const DashboardApp = {
    // DOM refs
    speedValue: document.getElementById("speed-value"),
    unitLabel: document.getElementById("unit-label"),
    distanceValue: document.getElementById("distance-value"),
    timeValue: document.getElementById("time-value"),
    startBtn: document.getElementById("start-button"),
    stopBtn: document.getElementById("stop-button"),
    unitToggle: document.getElementById("unit-toggle"),
    fullscreenToggle: document.getElementById("fullscreen-toggle"),
    gpsIndicator: document.getElementById("gps-indicator"),
    gpsText: document.getElementById("gps-text"),
    statusMessage: document.getElementById("status-message"),
    speedArc: document.getElementById("speed-arc"),
    distanceArc: document.getElementById("distance-arc"),
    timeArc: document.getElementById("time-arc"),
    batteryText: document.getElementById("battery-text"),

    // State
    watchId: null,
    isMetric: true,
    lastPos: null,
    distance: 0,
    duration: 0,
    timerInterval: null,
    speedHistory: [],
    SMOOTHING_WINDOW_SIZE: 10,
    ALPHA: 0.3, // Smoothing factor for exponential smoothing

    // Helpers
    haversine(lat1, lon1, lat2, lon2) {
      const R = 6371000, toRad = deg => (deg * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },
    formatTime(secs) {
      const m = String(Math.floor(secs / 60)).padStart(2, "0");
      const s = String(secs % 60).padStart(2, "0");
      return `${m}:${s}`;
    },
    speedToColor(kph) {
      if (kph < 20) return "#38A169"; // green
      if (kph < 35) return "#FBBF24"; // yellow
      return "#EF4444"; // red
    },

    updateSpeed(mps) {
      if (!mps || mps < 0) mps = 0;
      // Exponential smoothing: smoothed = alpha * new + (1 - alpha) * previous
      const newSpeed = this.speedHistory.length > 0 ? 
        this.ALPHA * mps + (1 - this.ALPHA) * this.speedHistory[this.speedHistory.length - 1] : mps;
      this.speedHistory.push(newSpeed);
      if (this.speedHistory.length > this.SMOOTHING_WINDOW_SIZE) this.speedHistory.shift();

      const avgMps = this.speedHistory.reduce((a, b) => a + b, 0) / this.speedHistory.length;
      const val = this.isMetric ? (avgMps * 3.6).toFixed(1) : (avgMps * 2.23694).toFixed(1);
      this.unitLabel.textContent = this.isMetric ? "km/h" : "mph";
      this.speedValue.textContent = val;

      // update arc & color dynamically
      this.speedArc.style.stroke = this.speedToColor(parseFloat(val));
      const pct = Math.min((val / 50) * 75, 75);
      this.speedArc.style.strokeDasharray = `${pct} 100`;
    },

    updateDistance() {
      const val = this.isMetric ? (this.distance / 1000).toFixed(2) : (this.distance * 0.000621371).toFixed(2);
      this.distanceValue.textContent = val;
      const pct = Math.min(((this.isMetric ? this.distance / 1000 : this.distance * 0.000621371) / 100) * 75, 75);
      this.distanceArc.style.strokeDasharray = `${pct} 100`;
    },

    updateTime() {
      this.timeValue.textContent = this.formatTime(this.duration);
      const pct = Math.min((this.duration / 3600) * 75, 75);
      this.timeArc.style.strokeDasharray = `${pct} 100`;
    },

    success(pos) {
      const { latitude, longitude, speed, accuracy } = pos.coords;

      // Use accuracy-based filtering
      if (accuracy > 20) {
        this.gpsIndicator.className = "w-3 h-3 rounded-full bg-yellow-500";
        this.gpsText.textContent = "Low Accuracy";
        this.statusMessage.textContent = "Low GPS Accuracy. Waiting for a better signal...";
        return;
      }

      if (this.lastPos) {
        const d = this.haversine(this.lastPos.latitude, this.lastPos.longitude, latitude, longitude);
        // Accumulate all distances greater than 0.1m to handle slow movements
        if (d > 0.1) this.distance += d;
      }
      this.lastPos = { latitude, longitude };

      this.updateDistance();
      this.updateSpeed(speed || 0);

      this.gpsIndicator.className = "w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50";
      this.gpsText.textContent = "GPS Active";
      this.statusMessage.textContent = "Tracking in progress...";
    },

    error(e) {
      this.gpsIndicator.className = "w-3 h-3 rounded-full bg-red-500";
      this.gpsText.textContent = "GPS Error";
      this.statusMessage.textContent = "GPS Error: " + e.message;
    },

    startTracking() {
      this.distance = 0; 
      this.duration = 0; 
      this.lastPos = null;
      this.speedHistory = [];
      this.updateDistance(); 
      this.updateTime();
      if (!navigator.geolocation) {
        this.statusMessage.textContent = "Geolocation not supported.";
        return;
      }
      this.watchId = navigator.geolocation.watchPosition(
        pos => this.success(pos), 
        err => this.error(err), 
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Increased timeout
      );
      this.startBtn.classList.add("hidden");
      this.stopBtn.classList.remove("hidden");
      this.startBtn.parentElement.classList.add("active-state"); // Visual feedback
      this.timerInterval = setInterval(() => { this.duration++; this.updateTime(); }, 1000);
    },

    stopTracking() {
      if (this.watchId) navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      clearInterval(this.timerInterval);
      this.startBtn.classList.remove("hidden");
      this.stopBtn.classList.add("hidden");
      this.startBtn.parentElement.classList.remove("active-state");
      this.statusMessage.textContent = "Tracking stopped.";
      this.speedHistory = [];
    },

    toggleUnits() {
      this.isMetric = !this.isMetric;
      this.updateDistance();
    },

    toggleFullscreen() {
      const dashboardElement = document.getElementById("dashboard");
      if (!document.fullscreenElement) {
        dashboardElement.requestFullscreen().catch(err => console.error(err));
        this.fullscreenToggle.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>'; // Exit icon
      } else {
        document.exitFullscreen();
        this.fullscreenToggle.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5m0 0l-5 5m5-5l5 5m0 0v4m0 0h-4m0 0l-5 5m5-5v4m0 0h-4"></path></svg>'; // Fullscreen icon
      }
    },

    initBattery() {
      if (navigator.getBattery) {
        navigator.getBattery().then(battery => {
          const updateBattery = () => {
            this.batteryText.textContent = `${(battery.level * 100).toFixed(0)}% ${battery.charging ? "(⚡)" : ""}`;
          };
          updateBattery();
          battery.addEventListener("levelchange", updateBattery);
          battery.addEventListener("chargingchange", updateBattery);
        });
      }
    },

    initEventListeners() {
      this.startBtn.addEventListener("click", () => this.startTracking());
      this.stopBtn.addEventListener("click", () => this.stopTracking());
      this.unitToggle.addEventListener("click", () => this.toggleUnits());
      this.fullscreenToggle.addEventListener("click", () => this.toggleFullscreen());
    },

    init() {
      this.initBattery();
      this.initEventListeners();
    }
  };

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function() {
      navigator.serviceWorker.register("service-worker.js");
    });
  }

  // Initialize the app
  DashboardApp.init();
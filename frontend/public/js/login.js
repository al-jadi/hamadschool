// Updated login.js to use API for authentication
document.addEventListener("DOMContentLoaded", function() {
  // Check if user is already logged in, if so, redirect to dashboard
  if (isLoggedIn()) {
    console.log("User already logged in, redirecting to dashboard...");
    window.location.href = "dashboard.html";
    return; // Stop further execution on this page
  }

  const loginForm = document.getElementById("loginForm");
  const messageArea = document.getElementById("messageArea");
  const submitButton = loginForm.querySelector("button[type=\"submit\"]");

  if (loginForm) {
    loginForm.addEventListener("submit", async function(e) {
      e.preventDefault();
      
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      
      // Disable button and show loading state
      submitButton.disabled = true;
      submitButton.innerHTML = 
        `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> جاري تسجيل الدخول...`;
      clearMessages(); // Clear previous messages

      try {
        // Attempt login using the API client
        console.log("Attempting API login...");
        const response = await api.login(email, password); // Assumes api.js is loaded
        console.log("API Login Response:", response);

        // --- REVERTED CHECK: Expect both token and user --- 
        if (response && response.token && response.user) {
          // Store token 
          storeAuthToken(response.token);
          
          // --- RE-ADDED: Storing user details from login response --- 
          // Ensure the user object stored has the role property correctly named
          // The backend now sends 'role' directly, matching frontend expectation
          storeCurrentUser(response.user); 
          
          // Show success message
          showMessage("تم تسجيل الدخول بنجاح! جاري التحويل...", "success");
          
          // Redirect to dashboard after a short delay
          setTimeout(function() {
            window.location.href = "dashboard.html";
          }, 1500);
        } else {
          // Handle cases where response might be missing token or user
          throw new Error("فشل تسجيل الدخول: استجابة غير متوقعة من الخادم (لم يتم العثور على التوكن أو بيانات المستخدم).");
        }

      } catch (error) {
        console.error("Login failed:", error);
        // Show error message from API or a generic one
        showMessage(error.message || "فشل تسجيل الدخول. يرجى التحقق من البريد الإلكتروني وكلمة المرور.", "error");
        
        // Re-enable button
        submitButton.disabled = false;
        submitButton.textContent = "تسجيل الدخول";
      }
    });
  }
  
  // Function to clear messages
  function clearMessages() {
      messageArea.innerHTML = "";
  }

  // Function to display messages to the user
  function showMessage(message, type) {
    clearMessages(); // Clear previous messages first
    
    const messageDiv = document.createElement("div");
    messageDiv.className = `alert alert-${type === "success" ? "success" : "danger"} mt-3`;
    messageDiv.textContent = message;
    
    messageArea.appendChild(messageDiv);
    
    // Optional: Auto-remove error messages after some time
    if (type === "error") {
        setTimeout(function() {
          if (messageArea.contains(messageDiv)) {
            messageArea.removeChild(messageDiv);
          }
        }, 5000); // Remove error after 5 seconds
    }
  }
});


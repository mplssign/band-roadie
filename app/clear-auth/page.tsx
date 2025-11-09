export default function ClearAuthPage() {
  const clearAuth = () => {
    // Clear all auth-related cookies and localStorage
    document.cookie.split(";").forEach((c) => {
      const eqPos = c.indexOf("=");
      const name = eqPos > -1 ? c.substr(0, eqPos) : c;
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    });
    
    // Clear localStorage
    localStorage.clear();
    sessionStorage.clear();
    
    // Redirect to login
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Clear Authentication</h1>
        <p className="text-muted-foreground">This will clear all auth data and redirect you to login</p>
        <button 
          onClick={clearAuth}
          className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
        >
          Clear Auth Data & Login
        </button>
      </div>
    </div>
  );
}
const { logMutation, triggerAutoBackup } = require('./backup');

/**
 * Middleware to automatically backup and log database mutations.
 * Intercepts POST, PATCH, PUT, and DELETE requests and triggers
 * a mutation log entry and a debounced full database backup.
 */
const backupMiddleware = (req, res, next) => {
  const mutationMethods = ['POST', 'PATCH', 'PUT', 'DELETE'];
  
  // Only intercept mutation methods and avoid backup-related endpoints to prevent loops
  if (mutationMethods.includes(req.method) && !req.originalUrl.includes('/backups')) {
    
    // Attempt to determine table from URL path
    let table = 'other';
    const url = req.originalUrl.toLowerCase();
    
    if (url.includes('/users')) {
      table = 'users';
    } else if (url.includes('/courses') || url.includes('/approve') || url.includes('/reject')) {
      table = 'courses';
    }

    // Listen for the response to finish
    res.on('finish', () => {
      // Only log successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const action = req.method === 'POST' ? 'INSERT' : 
                       (req.method === 'DELETE' ? 'DELETE' : 'UPDATE');
        
        // Prepare data for logging (remove sensitive fields)
        const logData = {
          path: req.originalUrl,
          method: req.method,
          params: req.params,
          query: req.query,
          body: { ...req.body }
        };

        // Sanitize sensitive data
        if (logData.body.password) logData.body.password = '[REDACTED]';
        if (logData.body.password_hash) delete logData.body.password_hash;
        if (logData.body.token) logData.body.token = '[REDACTED]';

        try {
          // 1. Log the specific mutation immediately
          logMutation(table, action, logData, req.user);
          
          // 2. Trigger a debounced full backup
          triggerAutoBackup();
          
          // Optional: Console log for admin visibility in logs
          console.log(`[BACKUP] Auto-logged ${action} on "${table}" (${req.originalUrl})`);
        } catch (err) {
          console.error('[BACKUP] Error during automatic backup trigger:', err.message);
        }
      }
    });
  }
  
  next();
};

module.exports = backupMiddleware;

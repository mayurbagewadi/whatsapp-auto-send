curl -X POST \
  "https://isfaiawbywrtwvinkizb.supabase.co/functions/v1/login" \
  -H "Content-Type: application/json" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzZmFpYXdieXdydHd2aW5raXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzIyMTQsImV4cCI6MjA4NjgwODIxNH0.DkuRC5vRmuXlds-z1TvTHj2pQsoFSsqPEINOlnaN2n0" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzZmFpYXdieXdydHd2aW5raXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzIyMTQsImV4cCI6MjA4NjgwODIxNH0.DkuRC5vRmuXlds-z1TvTHj2pQsoFSsqPEINOlnaN2n0" \
  -d '{"email":"test@test.com","password":"test123"}'

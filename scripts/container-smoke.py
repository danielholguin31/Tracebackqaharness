import subprocess,secrets,urllib.request,urllib.error,json,time
cmd=['env','-u','DOCKER_HOST','-u','DOCKER_TLS_VERIFY','-u','DOCKER_CERT_PATH','docker']
pw=secrets.token_hex(24)
subprocess.run(cmd+['run','-d','--name','traceback-v2-production-smoke','-p','127.0.0.1:3103:3001','-e','TRACEBACK_PASSWORD='+pw,'-e','SECRET_ENCRYPTION_KEY='+secrets.token_hex(32),'traceback-v2:qa'],check=True,stdout=subprocess.DEVNULL)
try:
 for i in range(30):
  try:
   with urllib.request.urlopen('http://localhost:3103/api/health') as r: assert json.load(r)['ok']
   break
  except Exception:time.sleep(1)
 else:raise RuntimeError('Production container did not start')
 with urllib.request.urlopen('http://localhost:3103/') as r:assert 'Traceback' in r.read().decode()
 try:urllib.request.urlopen('http://localhost:3103/api/tests');raise AssertionError('Unprotected API')
 except urllib.error.HTTPError as e:assert e.code==401
 req=urllib.request.Request('http://localhost:3103/api/auth/login',data=json.dumps({'password':pw}).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req) as r:cookie=r.headers['Set-Cookie'];assert 'HttpOnly' in cookie
 req=urllib.request.Request('http://localhost:3103/api/tests',headers={'Cookie':cookie})
 with urllib.request.urlopen(req) as r:assert r.status==200
 print('PASS: production container serves SPA, migrates database, protects API, and authenticates owner.')
finally:subprocess.run(cmd+['rm','-f','traceback-v2-production-smoke'],stdout=subprocess.DEVNULL,check=True)

import http from 'node:http';
const port=Number(process.env.FIXTURE_PORT||4010);
http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="en"><head><title>QA fixture</title></head><body><h1>Checkout fixture</h1><label>Email<input id="email" type="email"></label><button id="submit" onclick="document.querySelector(\'#result\').textContent=\'Order confirmed\'">Complete order</button><p id="result">Waiting for order</p></body></html>');}).listen(port,'0.0.0.0',()=>console.log(`QA fixture listening on ${port}`));

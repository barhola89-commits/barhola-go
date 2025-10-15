// api/redirect.js
export default function handler(req, res) {
  // هنا بنسحب اللينك من Environment Variable
  const target = process.env.TARGET_URL;

  res.writeHead(302, { Location: target });
  res.end();
}

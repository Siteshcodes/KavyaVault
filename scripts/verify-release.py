"""Verify the local ZIP, every manifest hash, and its extracted HTTP launcher.

Requires Python 3.11+ and Node.js on PATH; no third-party Python packages.
"""
import hashlib
import http.client
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import zipfile

repo = Path(__file__).resolve().parents[1]
archive_path = repo / 'artifacts/releases/kavyavault-1.0.0-local.zip'
digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
assert digest == archive_path.with_suffix('.zip.sha256').read_text().split()[0]
destination = Path(tempfile.mkdtemp(prefix='release-check-', dir=repo / 'artifacts')).resolve()
assert destination.is_relative_to((repo / 'artifacts').resolve())
with zipfile.ZipFile(archive_path) as archive:
    assert archive.testzip() is None, 'ZIP CRC failure'
    manifest = json.loads(archive.read('manifest.json'))
    expected_names = {entry['path'] for entry in manifest['files']} | {'manifest.json'}
    assert set(archive.namelist()) == expected_names
    assert len(archive.namelist()) == len(expected_names), 'Duplicate ZIP entries'
    for entry in manifest['files']:
        data = archive.read(entry['path'])
        assert len(data) == entry['bytes'], entry['path']
        assert hashlib.sha256(data).hexdigest() == entry['sha256'], entry['path']
        assert (destination / entry['path']).resolve().is_relative_to(destination)
    archive.extractall(destination)

with socket.socket() as port_probe:
    port_probe.bind(('127.0.0.1', 0))
    port = port_probe.getsockname()[1]
env = dict(os.environ, KAVYAVAULT_PORT=str(port))
process = subprocess.Popen(['node', 'serve.mjs'], cwd=destination, env=env,
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                           creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
checks = []

def request(target, method='GET'):
    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
    try:
        connection.request(method, target)
        response = connection.getresponse()
        return response.status, dict(response.getheaders()), response.read()
    finally:
        connection.close()

try:
    for attempt in range(60):
        assert process.poll() is None, 'Local launcher exited before startup'
        try:
            status, headers, index = request('/')
            break
        except ConnectionRefusedError:
            time.sleep(0.1)
    else:
        raise AssertionError('Local launcher did not start')
    assert status == 200 and index == (destination / 'app/index.html').read_bytes()
    assert headers['Content-Type'].startswith('text/html')
    assert headers['Cache-Control'] == 'no-cache'
    assert request('/books/synthetic')[2] == index
    assert request('/', 'HEAD')[0::2] == (200, b'')
    checks.extend(['root', 'SPA route', 'HEAD'])
    static_count = 0
    for entry in manifest['files']:
        if not entry['path'].startswith('app/'):
            continue
        target = '/' + entry['path'][4:]
        status, headers, data = request(target)
        assert status == 200 and hashlib.sha256(data).hexdigest() == entry['sha256'], target
        assert headers['X-Content-Type-Options'] == 'nosniff'
        if target.endswith('.js'):
            assert headers['Content-Type'].startswith('text/javascript')
        if target.endswith('.css'):
            assert headers['Content-Type'].startswith('text/css')
        if target.endswith('.ttf'):
            assert headers['Content-Type'] == 'font/ttf'
        if target.startswith('/assets/'):
            assert 'immutable' in headers['Cache-Control']
        if target == '/sw.js':
            assert headers['Cache-Control'] == 'no-cache'
            files_line = next(line for line in data.decode().splitlines() if line.startswith('const FILES = '))
            for cached_path in json.loads(files_line[len('const FILES = '):-1]):
                assert (destination / 'app' / cached_path.lstrip('/')).is_file(), cached_path
        static_count += 1
    assert request('/missing-file.js')[0] == 404
    assert request('/', 'POST')[0] == 405
    assert request('/%2e%2e%5cmanifest.json')[0] == 403
    checks.extend(['all static hashes and MIME types', 'cache manifest', 'missing file', 'method rejection', 'path containment'])
finally:
    process.terminate()
    process.communicate(timeout=10)

report = {'archive': archive_path.name, 'sha256': digest, 'bytes': archive_path.stat().st_size,
          'manifestFiles': len(manifest['files']), 'staticFiles': static_count,
          'zipCrc': True, 'manifestHashes': True, 'httpChecks': checks,
          'extractedTo': str(destination), 'launcherStopped': process.poll() is not None}
report_path = repo / 'artifacts/verification/release-validation.json'
report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))

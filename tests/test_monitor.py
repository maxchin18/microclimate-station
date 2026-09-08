import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import monitor

class EndTest(Exception):
    pass

class FakeDevice:
    def __init__(self, messages):
        self.messages = iter(messages)
        self.closed = False
        self.dtr = None
        self.rts = None
    def __enter__(self):
        return self
    def __exit__(self, *args):
        self.closed = True
    def readline(self, *_):
        try:
            return next(self.messages)
        except StopIteration:
            raise EndTest()

class MonitorTests(unittest.TestCase):
    def setUp(self):
        monitor.history.clear()
        monitor.update(latest=None, status='waiting')

    def test_rejects_invalid_measurements(self):
        for data in [None, [], {}, {'ok': False},
                     {'ok': True, 'temperature': float('nan'), 'humidity': 50},
                     {'ok': True, 'temperature': 25, 'humidity': 101},
                     {'ok': True, 'temperature': True, 'humidity': 50}]:
            self.assertFalse(monitor.valid_sample(data))

    def test_serial_boot_noise_and_sensor_failure(self):
        device = FakeDevice([b'\xff boot noise\n', b'{"ok":true,"temperature":26.5,"humidity":61}\n',
                             b'{"ok":false,"error":"DHT_READ_FAILED"}\n'])
        with patch.object(monitor.PAUSE.__class__, 'exists', return_value=False), \
             patch.object(monitor.list_ports, 'comports', return_value=[]), \
             patch.object(monitor.serial, 'Serial', return_value=device):
            with self.assertRaises(EndTest):
                monitor.reader('COM99')
        self.assertEqual(len(monitor.history), 1)
        self.assertEqual(monitor.state['latest']['temperature'], 26.5)
        self.assertEqual(monitor.state['status'], 'sensor_error')
        self.assertFalse(device.dtr)
        self.assertFalse(device.rts)
        self.assertTrue(device.closed)

    def test_no_usb_does_not_open_legacy_com_ports(self):
        port = SimpleNamespace(device='COM1', vid=None, description='Legacy')
        with patch.object(monitor.PAUSE.__class__, 'exists', return_value=False), \
             patch.object(monitor.list_ports, 'comports', return_value=[port]), \
             patch.object(monitor.serial, 'Serial') as serial_open, \
             patch.object(monitor.time, 'sleep', side_effect=EndTest):
            with self.assertRaises(EndTest):
                monitor.reader()
        serial_open.assert_not_called()
        self.assertEqual(monitor.state['status'], 'waiting')

    def test_disconnect_clears_live_status(self):
        with patch.object(monitor.PAUSE.__class__, 'exists', return_value=False), \
             patch.object(monitor.list_ports, 'comports', return_value=[]), \
             patch.object(monitor.serial, 'Serial', side_effect=monitor.serial.SerialException('unplugged')), \
             patch.object(monitor.time, 'sleep', side_effect=EndTest):
            with self.assertRaises(EndTest):
                monitor.reader('COM99')
        self.assertEqual(monitor.state['status'], 'disconnected')
        self.assertIsNone(monitor.state['port'])

if __name__ == '__main__':
    unittest.main()

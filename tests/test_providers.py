import base64
import json
import tempfile
import unittest
from unittest.mock import patch
from server.providers import Images, choose_images, design_text, extract_json, validate_plan
from server.__main__ import App


class ProviderTests(unittest.TestCase):
    def test_model_output_is_validated(self):
        for invalid in ({}, {'pages': []}, {'pages': [{'title': 'x', 'body': 3}]}):
            with self.assertRaises(ValueError):
                validate_plan(invalid)
        self.assertEqual(extract_json('```json\n{"pages": []}\n```'), {'pages': []})

    def test_no_tools_and_no_shell_are_granted_to_material(self):
        plan = {'title': '标题', 'pages': [{'title': '标题', 'body': '改写'}]}
        result = type('Result', (), {'returncode': 0, 'stderr': '', 'stdout': json.dumps({'result': json.dumps(plan)})})()
        with patch('server.providers.subprocess.run', return_value=result) as run:
            document = design_text('原文一\n\n原文二', 'auto', 'preserve', {'provider': 'claude-cli'})
            args, kwargs = run.call_args
            self.assertEqual(args[0][args[0].index('--tools') + 1], '')
            self.assertNotIn('shell', kwargs)
            self.assertEqual('\n\n'.join(p['body'] for p in document['pages']), '原文一\n\n原文二')

    def test_subprocess_failure_is_not_replaced_with_a_demo(self):
        result = type('Result', (), {'returncode': 7, 'stderr': 'provider failure', 'stdout': ''})()
        with patch('server.providers.subprocess.run', return_value=result):
            with self.assertRaisesRegex(RuntimeError, 'provider failure'):
                design_text('content', 'auto', 'polish', {'provider': 'claude-cli'})

    def test_assets_require_image_signature_and_known_candidate(self):
        with tempfile.TemporaryDirectory() as directory:
            images = Images(directory, {})
            with self.assertRaises(ValueError): images.store(b'<html>failure</html>', {})
            with self.assertRaises(ValueError): images.select('https://127.0.0.1/private')
            with self.assertRaisesRegex(ValueError, '尚未配置'): images.generate('a painting', None)

    def test_generation_contract_keeps_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            images = Images(directory, {})
            with patch('server.providers.request_json', return_value={'data': [{'b64_json': base64.b64encode(b'\x89PNG\r\n\x1a\nfixture').decode()}]}):
                image = images.generate('plant illustration', {'model': 'image-model', 'url': 'https://example.invalid/generate', 'api_key': 'test'})
            self.assertEqual(image['kind'], 'generated')
            self.assertEqual(image['prompt'], 'plant illustration')
            self.assertTrue(image['url'].startswith('/assets/'))

    def test_bad_input_does_not_call_provider(self):
        with tempfile.TemporaryDirectory() as directory:
            app = App({'web_root': directory, 'asset_dir': directory})
            with patch('server.__main__.design_text') as generate:
                with self.assertRaises(ValueError): app.design({'text': ''})
                generate.assert_not_called()

    def test_image_selection_cannot_invent_an_id_or_force_a_match(self):
        groups = {'coffee': [{'id': '12', 'title': 'Coffee'}], 'tree': [{'id': '13', 'title': 'Tree'}]}
        with patch('server.providers.model_json', return_value={'choices': [{'query': 'coffee', 'id': '999'}, {'query': 'tree', 'id': None}]}):
            self.assertEqual(choose_images(groups, {}), {})
        with patch('server.providers.model_json', return_value={'choices': [{'query': 'coffee', 'id': '12'}]}):
            self.assertEqual(choose_images(groups, {}), {'coffee': '12'})


if __name__ == '__main__':
    unittest.main()

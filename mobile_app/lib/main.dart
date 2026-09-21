import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:youtube_explode_dart/youtube_explode_dart.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:dio/dio.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  runApp(const UniversalDownloaderApp());
}

class UniversalDownloaderApp extends StatelessWidget {
  const UniversalDownloaderApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VidDown Universal',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2563EB),
          primary: const Color(0xFF2563EB),
        ),
        scaffoldBackgroundColor: const Color(0xFF0F172A),
      ),
      home: const BrowserSnifferScreen(),
    );
  }
}

class DetectedVideo {
  final String url;
  final String title;
  final String ext;
  final String? quality;

  DetectedVideo({
    required this.url,
    required this.title,
    required this.ext,
    this.quality,
  });
}

class BrowserSnifferScreen extends StatefulWidget {
  const BrowserSnifferScreen({super.key});

  @override
  State<BrowserSnifferScreen> createState() => _BrowserSnifferScreenState();
}

class _BrowserSnifferScreenState extends State<BrowserSnifferScreen> {
  InAppWebViewController? _webViewController;
  final TextEditingController _urlBarController = TextEditingController(text: 'https://www.google.com');

  double _pageLoadingProgress = 0.0;
  bool _isLoadingPage = false;
  String _currentTitle = 'Browser';

  // Detected media items on the current page
  final List<DetectedVideo> _detectedVideos = [];

  // Active Download State
  bool _isDownloading = false;
  double _downloadProgress = 0.0;
  String _downloadStatus = '';

  final YoutubeExplode _yt = YoutubeExplode();

  @override
  void dispose() {
    _urlBarController.dispose();
    _yt.close();
    super.dispose();
  }

  void _navigateToUrl(String input) {
    String destination = input.trim();
    if (destination.isEmpty) return;

    if (!destination.startsWith('http://') && !destination.startsWith('https://')) {
      if (destination.contains('.') && !destination.contains(' ')) {
        destination = 'https://$destination';
      } else {
        destination = 'https://www.google.com/search?q=${Uri.encodeComponent(destination)}';
      }
    }

    _urlBarController.text = destination;
    _webViewController?.loadUrl(
      urlRequest: URLRequest(url: WebUri(destination)),
    );
  }

  void _checkForVideoUrl(String rawUrl) {
    final lower = rawUrl.toLowerCase();
    
    // Check if network request is a video stream/asset
    bool isVideoFile = lower.contains('.mp4') ||
        lower.contains('.webm') ||
        lower.contains('.m4v') ||
        lower.contains('.mov') ||
        lower.contains('.m3u8') ||
        lower.contains('.mp3') ||
        lower.contains('video/mp4') ||
        lower.contains('mime=video');

    if (isVideoFile) {
      if (!_detectedVideos.any((v) => v.url == rawUrl)) {
        String ext = 'mp4';
        if (lower.contains('.webm')) ext = 'webm';
        if (lower.contains('.mov')) ext = 'mov';
        if (lower.contains('.mp3')) ext = 'mp3';

        setState(() {
          _detectedVideos.add(
            DetectedVideo(
              url: rawUrl,
              title: _currentTitle.isNotEmpty ? _currentTitle : 'Captured Media',
              ext: ext,
            ),
          );
        });
      }
    }
  }

  // Sniff DOM video tags directly inside the webpage
  Future<void> _sniffPageDomVideos() async {
    if (_webViewController == null) return;

    try {
      final result = await _webViewController!.evaluateJavascript(source: """
        (function() {
          var urls = [];
          // Check video tags
          var vids = document.querySelectorAll('video');
          for (var i = 0; i < vids.length; i++) {
            if (vids[i].src && vids[i].src.length > 5) {
              urls.push(vids[i].src);
            }
            var sources = vids[i].querySelectorAll('source');
            for (var j = 0; j < sources.length; j++) {
              if (sources[j].src && sources[j].src.length > 5) {
                urls.push(sources[j].src);
              }
            }
          }
          return urls;
        })();
      """);

      if (result != null && result is List) {
        for (var raw in result) {
          if (raw is String && raw.startsWith('http')) {
            _checkForVideoUrl(raw);
          }
        }
      }
    } catch (_) {}
  }

  Future<bool> _requestStoragePermissions() async {
    if (Platform.isAndroid) {
      if (await Permission.manageExternalStorage.isGranted) return true;
      if (await Permission.storage.isGranted) return true;

      final status = await Permission.storage.request();
      if (status.isGranted) return true;

      final manageStatus = await Permission.manageExternalStorage.request();
      return manageStatus.isGranted;
    }
    return true;
  }

  Future<Directory> _getDownloadDirectory() async {
    Directory? dir;
    if (Platform.isAndroid) {
      dir = Directory('/storage/emulated/0/Download');
      if (!await dir.exists()) {
        dir = await getExternalStorageDirectory();
      }
    } else {
      dir = await getApplicationDocumentsDirectory();
    }
    return dir ?? (await getApplicationDocumentsDirectory());
  }

  Future<void> _startDirectDownload(DetectedVideo video) async {
    final hasPermission = await _requestStoragePermissions();
    if (!hasPermission) {
      _showSnackbar('Storage permission is required to save downloads.');
      return;
    }

    setState(() {
      _isDownloading = true;
      _downloadProgress = 0.0;
      _downloadStatus = 'Starting download...';
    });

    try {
      final saveDir = await _getDownloadDirectory();
      final cleanTitle = video.title
          .replaceAll(RegExp(r'[\\/:*?"<>|]'), '_')
          .trim();
      final fileName = '${cleanTitle}_${DateTime.now().millisecondsSinceEpoch}.${video.ext}';
      final file = File('${saveDir.path}/$fileName');

      final dio = Dio();
      await dio.download(
        video.url,
        file.path,
        onReceiveProgress: (received, total) {
          if (total > 0) {
            setState(() {
              _downloadProgress = received / total;
              _downloadStatus =
                  '${(received / (1024 * 1024)).toStringAsFixed(1)} MB / ${(total / (1024 * 1024)).toStringAsFixed(1)} MB';
            });
          } else {
            setState(() {
              _downloadStatus = '${(received / (1024 * 1024)).toStringAsFixed(1)} MB downloaded';
            });
          }
        },
      );

      setState(() {
        _isDownloading = false;
        _downloadStatus = 'Saved!';
      });

      _showSuccessDialog(file.path, video.title);
    } catch (e) {
      setState(() {
        _isDownloading = false;
      });
      _showSnackbar('Download failed: $e');
    }
  }

  Future<void> _startYouTubeDownload(String youtubeUrl) async {
    final hasPermission = await _requestStoragePermissions();
    if (!hasPermission) {
      _showSnackbar('Storage permission is required.');
      return;
    }

    setState(() {
      _isDownloading = true;
      _downloadProgress = 0.0;
      _downloadStatus = 'Parsing YouTube streams...';
    });

    try {
      final videoId = VideoId(youtubeUrl);
      final video = await _yt.videos.get(videoId);
      final manifest = await _yt.videos.streamsClient.getManifest(videoId);
      final muxed = manifest.muxed.withHighestBitrate();

      final saveDir = await _getDownloadDirectory();
      final cleanTitle = video.title.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_').trim();
      final file = File('${saveDir.path}/$cleanTitle.mp4');

      final totalBytes = muxed.size.totalBytes;
      int downloadedBytes = 0;

      final stream = _yt.videos.streamsClient.get(muxed);
      final output = file.openWrite();

      await for (final chunk in stream) {
        output.add(chunk);
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          setState(() {
            _downloadProgress = downloadedBytes / totalBytes;
            _downloadStatus =
                '${(downloadedBytes / (1024 * 1024)).toStringAsFixed(1)} MB / ${(totalBytes / (1024 * 1024)).toStringAsFixed(1)} MB';
          });
        }
      }

      await output.flush();
      await output.close();

      setState(() {
        _isDownloading = false;
        _downloadStatus = 'Saved!';
      });

      _showSuccessDialog(file.path, video.title);
    } catch (e) {
      setState(() {
        _isDownloading = false;
      });
      _showSnackbar('YouTube stream error: $e');
    }
  }

  void _showSnackbar(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _showSuccessDialog(String filePath, String title) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.check_circle, color: Color(0xFF22C55E)),
            SizedBox(width: 8),
            Text('Saved to Device!', style: TextStyle(color: Colors.white)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white70),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 12),
            const Text(
              'Location in Downloads:',
              style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
            ),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                filePath,
                style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: Color(0xFF38BDF8)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('OK', style: TextStyle(color: Color(0xFF38BDF8))),
          ),
        ],
      ),
    );
  }

  void _showDetectedMediaModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Found Videos (${_detectedVideos.length})',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white70),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const Divider(color: Color(0xFF334155)),
              const SizedBox(height: 8),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 300),
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: _detectedVideos.length,
                  itemBuilder: (ctx, i) {
                    final item = _detectedVideos[i];
                    return Card(
                      color: const Color(0xFF0F172A),
                      margin: const EdgeInsets.only(bottom: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: Color(0xFF334155)),
                      ),
                      child: ListTile(
                        leading: const CircleAvatar(
                          backgroundColor: Color(0xFF2563EB),
                          child: Icon(Icons.play_arrow, color: Colors.white),
                        ),
                        title: Text(
                          item.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                        ),
                        subtitle: Text(
                          'Format: ${item.ext.toUpperCase()}',
                          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                        ),
                        trailing: ElevatedButton.icon(
                          onPressed: () {
                            Navigator.pop(ctx);
                            _startDirectDownload(item);
                          },
                          icon: const Icon(Icons.download, size: 16),
                          label: const Text('Download'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF22C55E),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    bool isYouTubePage = _urlBarController.text.contains('youtube.com') || _urlBarController.text.contains('youtu.be');

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        titleSpacing: 8,
        title: Container(
          height: 40,
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFF334155)),
          ),
          child: Row(
            children: [
              const SizedBox(width: 8),
              const Icon(Icons.search, size: 18, color: Color(0xFF64748B)),
              const SizedBox(width: 6),
              Expanded(
                child: TextField(
                  controller: _urlBarController,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: const InputDecoration(
                    hintText: 'Search or enter any website URL...',
                    hintStyle: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(vertical: 8),
                  ),
                  onSubmitted: _navigateToUrl,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.arrow_forward, size: 18, color: Color(0xFF38BDF8)),
                onPressed: () => _navigateToUrl(_urlBarController.text),
              ),
            ],
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: () => _webViewController?.reload(),
          ),
        ],
      ),
      body: Stack(
        children: [
          Column(
            children: [
              if (_isLoadingPage)
                LinearProgressIndicator(
                  value: _pageLoadingProgress > 0 ? _pageLoadingProgress : null,
                  minHeight: 3,
                  backgroundColor: const Color(0xFF1E293B),
                  valueColor: const AlwaysStoppedAnimation(Color(0xFF38BDF8)),
                ),
              Expanded(
                child: InAppWebView(
                  initialUrlRequest: URLRequest(url: WebUri('https://www.google.com')),
                  initialSettings: InAppWebViewSettings(
                    useShouldInterceptRequest: true,
                    mediaPlaybackRequiresUserGesture: false,
                    allowsInlineMediaPlayback: true,
                    javaScriptEnabled: true,
                    domStorageEnabled: true,
                    databaseEnabled: true,
                  ),
                  onWebViewCreated: (controller) {
                    _webViewController = controller;
                  },
                  onLoadStart: (controller, url) {
                    setState(() {
                      _isLoadingPage = true;
                      _detectedVideos.clear();
                      if (url != null) {
                        _urlBarController.text = url.toString();
                      }
                    });
                  },
                  onProgressChanged: (controller, progress) {
                    setState(() {
                      _pageLoadingProgress = progress / 100;
                    });
                  },
                  onLoadStop: (controller, url) async {
                    setState(() {
                      _isLoadingPage = false;
                    });
                    final title = await controller.getTitle();
                    if (title != null) {
                      setState(() {
                        _currentTitle = title;
                      });
                    }
                    _sniffPageDomVideos();
                  },
                  shouldInterceptRequest: (controller, request) async {
                    final raw = request.url.toString();
                    _checkForVideoUrl(raw);
                    return null;
                  },
                ),
              ),
              // Download Progress Overlay at bottom
              if (_isDownloading)
                Container(
                  color: const Color(0xFF1E293B),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            _downloadStatus,
                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                          Text(
                            '${(_downloadProgress * 100).toInt()}%',
                            style: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      LinearProgressIndicator(
                        value: _downloadProgress > 0 ? _downloadProgress : null,
                        minHeight: 6,
                        backgroundColor: const Color(0xFF0F172A),
                        valueColor: const AlwaysStoppedAnimation(Color(0xFF22C55E)),
                      ),
                    ],
                  ),
                ),
            ],
          ),

          // Floating Download Button (Near the video / On bottom right)
          if (_detectedVideos.isNotEmpty || isYouTubePage)
            Positioned(
              bottom: _isDownloading ? 80 : 24,
              right: 20,
              child: FloatingActionButton.extended(
                backgroundColor: const Color(0xFF22C55E),
                elevation: 6,
                icon: const Icon(Icons.download, color: Colors.white),
                label: Text(
                  isYouTubePage
                      ? 'Download YouTube Video'
                      : 'Download Video (${_detectedVideos.length})',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
                onPressed: () {
                  if (isYouTubePage) {
                    _startYouTubeDownload(_urlBarController.text);
                  } else {
                    _showDetectedMediaModal();
                  }
                },
              ),
            ),
        ],
      ),
    );
  }
}

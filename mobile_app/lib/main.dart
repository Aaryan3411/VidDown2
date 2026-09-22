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

// Robust YouTube Video ID extractor supporting all YouTube URL formats and shorts
String? extractYouTubeId(String rawUrl) {
  final trimmed = rawUrl.trim();
  if (trimmed.isEmpty) return null;

  // Direct 11-char ID
  if (RegExp(r'^[a-zA-Z0-9_-]{11}$').hasMatch(trimmed)) {
    return trimmed;
  }

  try {
    final uri = Uri.parse(trimmed);

    // 1. Check 'v' query parameter (e.g. youtube.com/watch?v=xxx)
    final v = uri.queryParameters['v'];
    if (v != null && RegExp(r'^[a-zA-Z0-9_-]{11}$').hasMatch(v)) {
      return v;
    }

    // 2. Path segments: shorts/ID, embed/ID, live/ID, v/ID
    final segments = uri.pathSegments;
    for (int i = 0; i < segments.length; i++) {
      final seg = segments[i].toLowerCase();
      if (seg == 'shorts' || seg == 'embed' || seg == 'v' || seg == 'live') {
        if (i + 1 < segments.length && RegExp(r'^[a-zA-Z0-9_-]{11}$').hasMatch(segments[i + 1])) {
          return segments[i + 1];
        }
      }
    }

    // youtu.be/ID
    if (uri.host.contains('youtu.be') && segments.isNotEmpty) {
      if (RegExp(r'^[a-zA-Z0-9_-]{11}$').hasMatch(segments.first)) {
        return segments.first;
      }
    }

    // Regex fallback for non-standard / escaped URLs
    final regExp = RegExp(
      r'(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([a-zA-Z0-9_-]{11})',
      caseSensitive: false,
    );
    final match = regExp.firstMatch(trimmed);
    if (match != null && match.groupCount >= 1) {
      return match.group(1);
    }
  } catch (_) {}
  return null;
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
  String? _activeYouTubeVideoId;

  final YoutubeExplode _yt = YoutubeExplode();

  @override
  void dispose() {
    _urlBarController.dispose();
    _yt.close();
    super.dispose();
  }

  Future<String?> _resolveActiveYouTubeId() async {
    if (_activeYouTubeVideoId != null && _activeYouTubeVideoId!.isNotEmpty) {
      return _activeYouTubeVideoId;
    }

    if (_webViewController != null) {
      try {
        final uri = await _webViewController!.getUrl();
        if (uri != null) {
          final id = extractYouTubeId(uri.toString());
          if (id != null) return id;
        }
      } catch (_) {}

      try {
        final jsUrl = await _webViewController!.evaluateJavascript(source: 'window.location.href');
        if (jsUrl != null && jsUrl is String && jsUrl.isNotEmpty) {
          final id = extractYouTubeId(jsUrl);
          if (id != null) return id;
        }
      } catch (_) {}
    }

    return extractYouTubeId(_urlBarController.text);
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

  void _showYouTubeFormatModal(String videoIdStr) {
    final cleanId = extractYouTubeId(videoIdStr);
    if (cleanId == null) {
      _showSnackbar('Please tap and open a YouTube video first.');
      return;
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.red.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.play_arrow_rounded, color: Colors.redAccent, size: 24),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Download YouTube Media',
                            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          Text(
                            'Select desired output format',
                            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white60),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Divider(color: Color(0xFF334155), height: 1),
                const SizedBox(height: 12),

                // Option 1: Full Video MP4
                Card(
                  color: const Color(0xFF0F172A),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: const BorderSide(color: Color(0xFF334155)),
                  ),
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    leading: const CircleAvatar(
                      backgroundColor: Color(0xFF2563EB),
                      child: Icon(Icons.movie_creation_outlined, color: Colors.white, size: 20),
                    ),
                    title: const Text(
                      'Download Video (MP4)',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                    subtitle: const Text(
                      'Best available quality with combined audio',
                      style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                    ),
                    trailing: const Icon(Icons.arrow_forward_ios, color: Colors.white54, size: 14),
                    onTap: () {
                      Navigator.pop(ctx);
                      _startYouTubeDownload(cleanId, audioOnly: false);
                    },
                  ),
                ),
                const SizedBox(height: 8),

                // Option 2: Audio Only MP3/M4A
                Card(
                  color: const Color(0xFF0F172A),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: const BorderSide(color: Color(0xFF334155)),
                  ),
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    leading: const CircleAvatar(
                      backgroundColor: Color(0xFF10B981),
                      child: Icon(Icons.music_note_rounded, color: Colors.white, size: 20),
                    ),
                    title: const Text(
                      'Download Audio Only (Music / MP3)',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                    subtitle: const Text(
                      'High bitrate sound track for offline music player',
                      style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                    ),
                    trailing: const Icon(Icons.arrow_forward_ios, color: Colors.white54, size: 14),
                    onTap: () {
                      Navigator.pop(ctx);
                      _startYouTubeDownload(cleanId, audioOnly: true);
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _startYouTubeDownload(String rawIdOrUrl, {bool audioOnly = false}) async {
    final cleanId = extractYouTubeId(rawIdOrUrl);
    if (cleanId == null) {
      _showSnackbar('Please open a YouTube video first to download.');
      return;
    }

    final hasPermission = await _requestStoragePermissions();
    if (!hasPermission) {
      _showSnackbar('Storage permission is required to save downloads.');
      return;
    }

    setState(() {
      _isDownloading = true;
      _downloadProgress = 0.0;
      _downloadStatus = 'Connecting to YouTube...';
    });

    YoutubeExplode yt = YoutubeExplode();
    IOSink? output;

    try {
      final videoId = VideoId(cleanId);

      setState(() {
        _downloadStatus = 'Fetching video information...';
      });
      final video = await yt.videos.get(videoId);

      setState(() {
        _downloadStatus = 'Parsing stream manifest...';
      });
      final manifest = await yt.videos.streamsClient.getManifest(videoId);

      StreamInfo? selectedStream;
      String fileExt = 'mp4';

      if (audioOnly) {
        if (manifest.audioOnly.isNotEmpty) {
          selectedStream = manifest.audioOnly.withHighestBitrate();
          fileExt = selectedStream.container.name;
        } else if (manifest.audio.isNotEmpty) {
          selectedStream = manifest.audio.withHighestBitrate();
          fileExt = 'mp3';
        }
      } else {
        // Preferred order for video:
        // 1. Muxed streams (both video & audio combined)
        if (manifest.muxed.isNotEmpty) {
          try {
            selectedStream = manifest.muxed.withHighestBitrate();
            fileExt = 'mp4';
          } catch (_) {}
        }

        // 2. High-res video stream fallback
        if (selectedStream == null && manifest.video.isNotEmpty) {
          try {
            selectedStream = manifest.video.withHighestBitrate();
            fileExt = selectedStream.container.name;
          } catch (_) {}
        }

        // 3. Audio stream fallback
        if (selectedStream == null && manifest.audioOnly.isNotEmpty) {
          try {
            selectedStream = manifest.audioOnly.withHighestBitrate();
            fileExt = 'mp3';
          } catch (_) {}
        }
      }

      if (selectedStream == null) {
        throw Exception('No playable video or audio streams found for this video.');
      }

      final saveDir = await _getDownloadDirectory();
      final cleanTitle = video.title
          .replaceAll(RegExp(r'[\\/:*?"<>|]'), '_')
          .replaceAll(RegExp(r'\s+'), ' ')
          .trim();
      final safeTitle = cleanTitle.isNotEmpty ? cleanTitle : 'youtube_${videoId.value}';
      final file = File('${saveDir.path}/$safeTitle.$fileExt');

      final totalBytes = selectedStream.size.totalBytes;
      int downloadedBytes = 0;

      setState(() {
        _downloadStatus =
            'Downloading ${audioOnly ? "Audio" : (selectedStream?.qualityLabel ?? fileExt.toUpperCase())}...';
      });

      final stream = yt.videos.streamsClient.get(selectedStream);
      output = file.openWrite();

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
      output = null;

      setState(() {
        _isDownloading = false;
        _downloadStatus = 'Saved!';
      });

      _showSuccessDialog(file.path, video.title);
    } catch (e) {
      if (output != null) {
        try {
          await output.close();
        } catch (_) {}
      }
      setState(() {
        _isDownloading = false;
      });

      String userMsg = e.toString();
      if (userMsg.contains('Invalid argument')) {
        userMsg = 'Invalid YouTube video ID or stream format. Please select another video.';
      } else if (userMsg.contains('VideoUnplayableException')) {
        userMsg = 'This video is private, age-restricted, or blocked by copyright in this region.';
      } else if (userMsg.contains('SocketException')) {
        userMsg = 'Network connection interrupted. Please check your internet connection.';
      }
      _showSnackbar('Download note: $userMsg');
    } finally {
      yt.close();
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
                        final strUrl = url.toString();
                        _urlBarController.text = strUrl;
                        _activeYouTubeVideoId = extractYouTubeId(strUrl);
                      }
                    });
                  },
                  onUpdateVisitedHistory: (controller, url, isReload) {
                    if (url != null) {
                      final strUrl = url.toString();
                      setState(() {
                        _urlBarController.text = strUrl;
                        _activeYouTubeVideoId = extractYouTubeId(strUrl);
                      });
                    }
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
                    if (title != null && title.isNotEmpty) {
                      setState(() {
                        _currentTitle = title;
                      });
                    }
                    if (url != null) {
                      final strUrl = url.toString();
                      setState(() {
                        _urlBarController.text = strUrl;
                        _activeYouTubeVideoId = extractYouTubeId(strUrl);
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
                  (_activeYouTubeVideoId != null || extractYouTubeId(_urlBarController.text) != null)
                      ? 'Download YouTube Media'
                      : isYouTubePage
                          ? 'Play Video to Download'
                          : 'Download Video (${_detectedVideos.length})',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
                onPressed: () async {
                  if (isYouTubePage) {
                    final videoId = await _resolveActiveYouTubeId();
                    if (videoId == null) {
                      _showSnackbar('Please tap and open any YouTube video first before downloading.');
                      return;
                    }
                    _showYouTubeFormatModal(videoId);
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

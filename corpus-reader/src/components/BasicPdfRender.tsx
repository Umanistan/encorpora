import {
  readFileSrc,
  updateBookProgress,
  getBookInformation,
  BookEntry,
} from "@/lib/utils";
import { useEffect, useState, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  AlertCircle,
  Loader2,
  Grid3X3,
  ScrollText,
  ArrowUpDown,
  Moon,
  Sun,
  ArrowLeft,
  Lightbulb,
  Minus,
  Plus,
  Menu,
} from "lucide-react";
import PdfToc from "./pdfViewer/PdfToc";
import PdfSearch from "./PdfSearch";
import { useTheme } from "@/components/ThemeProvider";
import { usePdfViewerStore } from "@/store/usePdfViewerStore";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentLoadSuccess {
  numPages: number;
}

function BasicPdfRender() {
  const { bookPath } = useParams<{ bookPath: string }>();
  const { theme, setTheme } = useTheme();

  // Use Zustand store for persistent settings
  const {
    settings,
    setScale,
    setRotation,
    setViewMode,
    setReadingMode,
    setBrightness,
  } = usePdfViewerStore();

  // Local state for non-persistent values
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookInfo, setBookInfo] = useState<BookEntry | null>(null);

  // Use ref to track the last saved page to avoid unnecessary updates
  const lastSavedPageRef = useRef<number>(1);

  // Extract settings from store
  const { scale, rotation, viewMode, readingMode, brightness } = settings;

  // Load book information and restore last read page
  useEffect(() => {
    if (!bookPath) {
      console.log("No bookPath provided");
      return;
    }

    const loadBookInfo = async () => {
      try {
        const info = await getBookInformation(bookPath);
        if (info) {
          setBookInfo(info);
          // Restore last read page if available
          if (info.last_read_page && info.last_read_page > 0) {
            setCurrentPage(info.last_read_page);
            lastSavedPageRef.current = info.last_read_page;
            console.log(`Restored last read page: ${info.last_read_page}`);
          }
        }
      } catch (error) {
        console.error("Error loading book information:", error);
      }
    };

    loadBookInfo();
  }, [bookPath]);

  // Load PDF file
  useEffect(() => {
    if (!bookPath) {
      console.log("No bookPath provided");
      return;
    }

    console.log("Loading PDF from path:", bookPath);
    setLoading(true);
    setError(null);
    setFile(null);

    let isActive = true;

    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isActive) {
        console.error("PDF loading timeout");
        setError("PDF loading timed out. Please try again.");
        setLoading(false);
      }
    }, 15000); // 15 second timeout

    readFileSrc(bookPath)
      .then(async (fileData) => {
        if (!isActive) return;

        console.log("File data received:", fileData);
        console.log("File data type:", typeof fileData);
        setFile(fileData);
        setError(null);
        setLoading(false); // Set loading to false immediately after getting file data
        clearTimeout(timeoutId);
      })
      .catch((error) => {
        if (!isActive) return;

        console.error("Error loading book:", error);
        setError(`Failed to load PDF file: ${error.message}`);
        setLoading(false);
        clearTimeout(timeoutId);
      });

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [bookPath]);

  // Update progress when current page changes
  useEffect(() => {
    if (!bookPath || !numPages || currentPage === lastSavedPageRef.current) {
      return;
    }

    // Debounce the progress update to avoid too many database calls
    const timeoutId = setTimeout(async () => {
      try {
        const progress = Math.round((currentPage / numPages) * 100);
        await updateBookProgress(bookPath, currentPage, progress);
        lastSavedPageRef.current = currentPage;
        console.log(
          `Progress updated: Page ${currentPage}/${numPages} (${progress}%)`
        );
      } catch (error) {
        console.error("Error updating book progress:", error);
      }
    }, 1000); // Wait 1 second before saving to avoid rapid updates

    return () => clearTimeout(timeoutId);
  }, [currentPage, numPages, bookPath]);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: DocumentLoadSuccess) => {
      console.log("PDF loaded successfully with", numPages, "pages");
      setNumPages(numPages);
      setError(null);
      setLoading(false);
    },
    []
  );

  const onDocumentLoadError = useCallback((err: Error) => {
    console.error("PDF load error:", err);
    setError(`Failed to load PDF: ${err.message}`);
    setLoading(false);
  }, []);

  const goToPrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(numPages || 1, prev + 1));
  };

  const zoomIn = () => {
    setScale(scale + 0.2);
  };

  const zoomOut = () => {
    setScale(scale - 0.2);
  };

  const rotate = () => {
    setRotation(rotation + 90);
  };

  const goToPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    setViewMode("single");
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === "single" ? "grid" : "single");
  };

  const cycleReadingMode = () => {
    setReadingMode(readingMode === "page" ? "vertical" : "page");
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const increaseBrightness = () => {
    setBrightness(brightness + 10);
  };

  const decreaseBrightness = () => {
    setBrightness(brightness - 10);
  };

  const getReadingModeIcon = () => {
    switch (readingMode) {
      case "page":
        return <ScrollText className="h-4 w-4" />;
      case "vertical":
        return <ArrowUpDown className="h-4 w-4" />;
    }
  };

  const getReadingModeTitle = () => {
    switch (readingMode) {
      case "page":
        return "Page Mode - Click for Vertical Scroll";
      case "vertical":
        return "Vertical Scroll - Click for Page Mode";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <h3 className="text-lg font-semibold mb-2">Loading PDF</h3>
          <p className="text-muted-foreground">
            Please wait while we load your document...
          </p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error Loading PDF</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header with controls */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        {/* Main Header Row */}
        <div className="flex items-center justify-between p-3 md:p-4">
          {/* Left side - Back button and title */}
          <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.history.back()}
              aria-label="Back"
              className="shrink-0"
            >
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
            <div className="flex items-center gap-1 md:gap-2 min-w-0">
              <FileText className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0" />
              <span className="font-medium text-sm md:text-base truncate">
                {bookInfo?.title}
              </span>
            </div>
            {numPages && (
              <Badge
                variant="secondary"
                className="hidden sm:inline-flex text-xs"
              >
                {numPages} page{numPages !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {/* Center - Page info and navigation (mobile-first) */}
          <div className="flex items-center gap-1 md:gap-2 mx-2 md:mx-4">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevPage}
              disabled={currentPage <= 1}
              className="h-8 px-2 md:px-3"
            >
              <ChevronLeft className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline ml-1">Prev</span>
            </Button>

            {numPages && (
              <div className="flex items-center gap-1 md:gap-2 px-1 md:px-2">
                <span className="text-xs md:text-sm font-medium whitespace-nowrap">
                  {currentPage}/{numPages}
                </span>
                <div className="w-12 md:w-16 hidden sm:block">
                  <Progress
                    value={(currentPage / numPages) * 100}
                    className="h-1.5 md:h-2"
                  />
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={currentPage >= (numPages || 0)}
              className="h-8 px-2 md:px-3"
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
          </div>

          {/* Right side - Menu toggle and essential controls */}
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            {/* Essential controls always visible */}
            <div className="flex items-center gap-1 md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={zoomOut}
                disabled={scale <= 0.5}
                className="h-8 w-8 p-0"
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={zoomIn}
                disabled={scale >= 3}
                className="h-8 w-8 p-0"
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
            </div>

            {/* Mobile drawer toggle */}
            <Drawer>
              <DrawerTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 md:hidden"
                  aria-label="Open settings"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>PDF Settings</DrawerTitle>
                </DrawerHeader>
                <div className="p-4 pb-8">
                  <div className="grid grid-cols-2 gap-4">
                    {/* View Controls */}
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        View
                      </div>
                      <div className="space-y-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cycleReadingMode}
                          className="w-full h-10 justify-start gap-3"
                        >
                          {getReadingModeIcon()}
                          <span className="text-sm">
                            {readingMode === "page"
                              ? "Page Mode"
                              : "Scroll Mode"}
                          </span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={toggleViewMode}
                          className="w-full h-10 justify-start gap-3"
                        >
                          <Grid3X3 className="h-4 w-4" />
                          <span className="text-sm">
                            {viewMode === "single"
                              ? "Single View"
                              : "Grid View"}
                          </span>
                        </Button>
                      </div>
                    </div>

                    {/* Tools */}
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Tools
                      </div>
                      <div className="space-y-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={rotate}
                          className="w-full h-10 justify-start gap-3"
                        >
                          <RotateCw className="h-4 w-4" />
                          <span className="text-sm">Rotate</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={toggleTheme}
                          className="w-full h-10 justify-start gap-3"
                        >
                          {theme === "dark" ? (
                            <Sun className="h-4 w-4" />
                          ) : (
                            <Moon className="h-4 w-4" />
                          )}
                          <span className="text-sm">
                            {theme === "dark" ? "Light Mode" : "Dark Mode"}
                          </span>
                        </Button>
                      </div>
                    </div>

                    {/* Zoom Control */}
                    <div className="col-span-2 space-y-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Zoom
                      </div>
                      <div className="flex items-center gap-3 bg-muted/30 rounded-xl p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={zoomOut}
                          disabled={scale <= 0.5}
                          className="h-10 w-10 p-0 rounded-full"
                        >
                          <ZoomOut className="h-5 w-5" />
                        </Button>
                        <div className="flex-1 text-center">
                          <span className="text-lg font-semibold">
                            {Math.round(scale * 100)}%
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={zoomIn}
                          disabled={scale >= 3}
                          className="h-10 w-10 p-0 rounded-full"
                        >
                          <ZoomIn className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>

                    {/* Brightness Control */}
                    <div className="col-span-2 space-y-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Brightness
                      </div>
                      <div className="flex items-center gap-3 bg-muted/30 rounded-xl p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={decreaseBrightness}
                          disabled={brightness <= 20}
                          className="h-10 w-10 p-0 rounded-full"
                        >
                          <Minus className="h-5 w-5" />
                        </Button>
                        <div className="flex-1 text-center flex items-center justify-center gap-2">
                          <Lightbulb className="h-5 w-5" />
                          <span className="text-lg font-semibold">
                            {brightness}%
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={increaseBrightness}
                          disabled={brightness >= 150}
                          className="h-10 w-10 p-0 rounded-full"
                        >
                          <Plus className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>

                    {/* Search and Table of Contents */}
                    <div className="col-span-2 pt-2 space-y-4">
                      <PdfSearch
                        file={file}
                        numPages={numPages}
                        onGoToPage={goToPage}
                        currentPage={currentPage}
                      />
                      <PdfToc
                        currentPage={currentPage}
                        file={file}
                        goToPage={goToPage}
                        numPages={numPages}
                        rotation={rotation}
                      />
                    </div>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>

            {/* Desktop controls - always visible on larger screens */}
            <div className="hidden md:flex items-center gap-2">
              <PdfSearch
                file={file}
                numPages={numPages}
                onGoToPage={goToPage}
                currentPage={currentPage}
              />

              <PdfToc
                currentPage={currentPage}
                file={file}
                goToPage={goToPage}
                numPages={numPages}
                rotation={rotation}
              />

              <Separator orientation="vertical" className="h-6" />

              <Button
                variant="ghost"
                size="sm"
                onClick={cycleReadingMode}
                className="h-8 w-8 p-0"
                title={getReadingModeTitle()}
              >
                {getReadingModeIcon()}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={toggleViewMode}
                className="h-8 w-8 p-0"
                title={viewMode === "single" ? "Grid View" : "Single Page View"}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-6" />

              <div className="flex items-center gap-1 border rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={zoomOut}
                  disabled={scale <= 0.5}
                  className="h-6 w-6 p-0"
                >
                  <ZoomOut className="h-3 w-3" />
                </Button>
                <span className="text-xs font-medium px-1 min-w-[3rem] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={zoomIn}
                  disabled={scale >= 3}
                  className="h-6 w-6 p-0"
                >
                  <ZoomIn className="h-3 w-3" />
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={rotate}
                className="h-8 w-8 p-0"
                title="Rotate PDF"
              >
                <RotateCw className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-6" />

              <div className="flex items-center gap-1 border rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={decreaseBrightness}
                  disabled={brightness <= 20}
                  className="h-6 w-6 p-0"
                  title="Decrease brightness"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="flex items-center gap-1 px-1">
                  <Lightbulb className="h-3 w-3" />
                  <span className="text-xs font-medium min-w-[2.5rem] text-center">
                    {brightness}%
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={increaseBrightness}
                  disabled={brightness >= 150}
                  className="h-6 w-6 p-0"
                  title="Increase brightness"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <Separator orientation="vertical" className="h-6" />

              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="h-8 w-8 p-0"
                title={
                  theme === "dark"
                    ? "Switch to Light Mode"
                    : "Switch to Dark Mode"
                }
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Content */}
      <ScrollArea className="flex-1">
        {viewMode === "single" ? (
          // Single Page or Scroll Views
          readingMode === "page" ? (
            // Page Mode - Single page at a time
            <div className="flex justify-center p-6">
              <div className="max-w-full relative">
                <Document
                  file={file}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  }
                  className="shadow-lg"
                >
                  <div
                    className="relative"
                    style={{
                      filter: `brightness(${brightness}%)`,
                    }}
                  >
                    <Page
                      pageNumber={currentPage}
                      scale={scale}
                      rotate={rotation}
                      loading={
                        <div className="flex items-center justify-center p-8 bg-muted/20 rounded-lg">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      }
                      className="shadow-lg border rounded-lg overflow-hidden"
                    />
                  </div>
                </Document>
              </div>
            </div>
          ) : (
            // Vertical Scroll Mode - All pages in a vertical column
            <div className="flex justify-center p-6">
              <div className="max-w-full space-y-4">
                <Document
                  file={file}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  }
                >
                  <div
                    style={{
                      filter: `brightness(${brightness}%)`,
                    }}
                  >
                    {numPages &&
                      Array.from({ length: numPages }, (_, i) => i + 1).map(
                        (pageNum) => (
                          <div key={pageNum} className="relative">
                            <Page
                              pageNumber={pageNum}
                              scale={scale}
                              rotate={rotation}
                              loading={
                                <div className="flex items-center justify-center p-8 bg-muted/20 rounded-lg">
                                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                              }
                              className="shadow-lg border rounded-lg overflow-hidden mb-4"
                            />
                            <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                              Page {pageNum}
                            </div>
                          </div>
                        )
                      )}
                  </div>
                </Document>
              </div>
            </div>
          )
        ) : (
          // Grid View - All Pages
          <div className="p-6">
            <Document
              file={file}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              }
            >
              <div
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4"
                style={{
                  filter: `brightness(${brightness}%)`,
                }}
              >
                {numPages &&
                  Array.from({ length: numPages }, (_, i) => i + 1).map(
                    (pageNum) => (
                      <div
                        key={pageNum}
                        className={`max-w-fit relative cursor-pointer transition-all duration-200 hover:scale-105 ${
                          currentPage === pageNum
                            ? "ring-2 ring-primary ring-offset-2 shadow-lg"
                            : "hover:shadow-md"
                        }`}
                        onClick={() => goToPage(pageNum)}
                      >
                        <div className="relative">
                          <Page
                            pageNumber={pageNum}
                            scale={0.3}
                            rotate={rotation}
                            loading={
                              <div className="flex items-center justify-center p-4 bg-muted/20 rounded-lg">
                                <Loader2 className="h-4 w-4 animate-spin text-primary max-w-fit" />
                              </div>
                            }
                            className="shadow border rounded-lg overflow-hidden"
                          />
                          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                            {pageNum}
                          </div>
                        </div>
                      </div>
                    )
                  )}
              </div>
            </Document>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default BasicPdfRender;

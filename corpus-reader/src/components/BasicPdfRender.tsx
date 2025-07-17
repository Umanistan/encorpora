import { readFileSrc } from "@/lib/utils";
import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import PdfToc from "./pdfViewer/PdfToc";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentLoadSuccess {
  numPages: number;
}

function BasicPdfRender() {
  const { bookPath } = useParams<{ bookPath: string }>();

  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1.2);
  const [rotation, setRotation] = useState(0);
  const [viewMode, setViewMode] = useState<"single" | "grid">("single");
  const [readingMode, setReadingMode] = useState<"page" | "vertical">("page");

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
    setScale((prev) => Math.min(3, prev + 0.2));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(0.5, prev - 0.2));
  };

  const rotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const goToPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    setViewMode("single");
  };

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === "single" ? "grid" : "single"));
  };

  const cycleReadingMode = () => {
    setReadingMode((prev) => (prev === "page" ? "vertical" : "page"));
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
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-medium">PDF Reader</span>
            </div>
            {numPages && (
              <Badge variant="secondary">
                {numPages} page{numPages !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Table of Contents */}
            <PdfToc
              currentPage={currentPage}
              file={file}
              goToPage={goToPage}
              numPages={numPages}
              rotation={rotation}
            />

            <Separator orientation="vertical" className="h-6" />

            {/* Reading Mode Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={cycleReadingMode}
              className="h-8 w-8 p-0"
              title={getReadingModeTitle()}
            >
              {getReadingModeIcon()}
            </Button>

            <Separator orientation="vertical" className="h-6" />

            {/* View Mode Toggle */}
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

            {/* Zoom controls */}
            <div className="flex items-center gap-1 border rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={zoomOut}
                disabled={scale <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-2 min-w-[4rem] text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={zoomIn}
                disabled={scale >= 3}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Rotation control */}
            <Button
              variant="ghost"
              size="sm"
              onClick={rotate}
              className="h-8 w-8 p-0"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Navigation bar */}
        {numPages && (
          <div className="flex items-center justify-between px-4 pb-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevPage}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={currentPage >= numPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {numPages}
              </span>
              <div className="w-32">
                <Progress
                  value={(currentPage / numPages) * 100}
                  className="h-2"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PDF Content */}
      <ScrollArea className="flex-1">
        {viewMode === "single" ? (
          // Single Page or Scroll Views
          readingMode === "page" ? (
            // Page Mode - Single page at a time
            <div className="flex justify-center p-6">
              <div className="max-w-full">
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
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

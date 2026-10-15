import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Download, Clock, User, AlertCircle, FileAudio, FileVideo, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { AdBanner, AdMobile } from "@/components/ads";
import { useFetchVideoInfo, useCreateDownload, useGetDownloadStatus, getGetDownloadStatusQueryKey, VideoInfo, getDownloadFileUrl } from "@/lib/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const urlSchema = z.object({
  url: z.string().url("Please enter a valid URL").regex(/(youtube\.com|youtu\.be)/, "Must be a YouTube URL"),
});

export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [activeTab, setActiveTab] = useState<"video" | "audio">("video");
  const [selectedFormatId, setSelectedFormatId] = useState<string>("");
  const [jobId, setJobId] = useState<string | null>(null);

  const fetchInfo = useFetchVideoInfo();
  const createDownload = useCreateDownload();

  const { data: jobStatus, isLoading: isJobLoading } = useGetDownloadStatus(jobId || "", {
    query: {
      enabled: !!jobId,
      refetchInterval: (query) => {
        const job = query.state.data;
        if (job?.status === 'error' || (job?.status === 'done' && !job.fileAvailable)) return false;
        return 2000;
      },
      queryKey: getGetDownloadStatusQueryKey(jobId || "")
    }
  });

  const form = useForm<z.infer<typeof urlSchema>>({
    resolver: zodResolver(urlSchema),
    defaultValues: { url: "" },
  });

  const onSubmitUrl = (data: z.infer<typeof urlSchema>) => {
    setVideoInfo(null);
    setJobId(null);
    fetchInfo.mutate({ data: { url: data.url } }, {
      onSuccess: (info) => {
        setVideoInfo(info);
        void queryClient.invalidateQueries({ queryKey: ["/api/history"] });
        const defaultVideoFormat = info.formats.find(f => f.type === 'video');
        const defaultAudioFormat = info.formats.find(f => f.type === 'audio');
        
        if (defaultVideoFormat) {
          setSelectedFormatId(defaultVideoFormat.formatId);
          setActiveTab("video");
        } else if (defaultAudioFormat) {
          setSelectedFormatId(defaultAudioFormat.formatId);
          setActiveTab("audio");
        }
      },
      onError: (err) => {
        toast({
          title: "Analysis Failed",
          description: (err.data as any)?.error || "Could not fetch video info.",
          variant: "destructive"
        });
      }
    });
  };

  const onDownload = () => {
    if (!videoInfo || !selectedFormatId) return;

    createDownload.mutate({
      data: {
        url: videoInfo.url,
        formatId: selectedFormatId,
        mediaType: activeTab,
        videoTitle: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        channel: videoInfo.channel
      }
    }, {
      onSuccess: (job) => {
        setJobId(job.id);
      },
      onError: (err) => {
        toast({
          title: "Download Failed",
          description: (err.data as any)?.error || "Could not start download job.",
          variant: "destructive"
        });
      }
    });
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatsForActiveTab = videoInfo?.formats.filter(f => f.type === activeTab) || [];

  useEffect(() => {
    if (formatsForActiveTab.length > 0 && !formatsForActiveTab.find(f => f.formatId === selectedFormatId)) {
      setSelectedFormatId(formatsForActiveTab[0].formatId);
    }
  }, [activeTab, formatsForActiveTab, selectedFormatId]);

  return (
    <div className="flex flex-col gap-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
          Grab it. <span className="text-primary">Fast.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          The cleanest, fastest YouTube video and audio converter. Paste your link below.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmitUrl)} className="flex flex-col sm:flex-row gap-3">
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
                    <Input 
                      placeholder="Paste YouTube URL here..." 
                      className="h-14 pl-12 text-lg bg-card/50 backdrop-blur border-border/50 focus-visible:ring-primary shadow-sm"
                      {...field} 
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button 
            type="submit" 
            size="lg" 
            className="h-14 px-8 text-lg font-semibold"
            disabled={fetchInfo.isPending}
          >
            {fetchInfo.isPending ? "Analyzing..." : "Analyze"}
          </Button>
        </form>
      </Form>

      {videoInfo && !jobId && (
        <>
          <AdBanner className="my-2" />
          
          <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur shadow-xl animate-in zoom-in-95 duration-300">
            <div className="flex flex-col md:flex-row">
              <div className="md:w-1/3 relative aspect-video md:aspect-auto">
                <img src={videoInfo.thumbnail} alt={videoInfo.title} className="w-full h-full object-cover" />
                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-mono px-2 py-1 rounded">
                  {formatDuration(videoInfo.duration)}
                </div>
              </div>
              <div className="p-6 md:w-2/3 flex flex-col">
                <h3 className="text-xl font-bold line-clamp-2 mb-2" title={videoInfo.title}>
                  {videoInfo.title}
                </h3>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
                  <span className="flex items-center gap-1"><User className="h-4 w-4" /> {videoInfo.channel}</span>
                  {videoInfo.viewCount && <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {videoInfo.viewCount.toLocaleString()} views</span>}
                </div>

                <div className="mt-auto space-y-4">
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "video"|"audio")} className="w-full">
                    <TabsList className="w-full grid grid-cols-2">
                      <TabsTrigger value="video" className="flex items-center gap-2"><FileVideo className="h-4 w-4"/> Video</TabsTrigger>
                      <TabsTrigger value="audio" className="flex items-center gap-2"><FileAudio className="h-4 w-4"/> Audio</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className="flex gap-3">
                    <Select value={selectedFormatId} onValueChange={setSelectedFormatId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select Quality" />
                      </SelectTrigger>
                      <SelectContent>
                        {formatsForActiveTab.map(f => (
                          <SelectItem key={f.formatId} value={f.formatId}>
                            {f.label} {f.quality ? `(${f.quality})` : ''} {f.filesize ? `- ${(f.filesize / 1024 / 1024).toFixed(1)}MB` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Button 
                      onClick={onDownload} 
                      className="w-1/3" 
                      disabled={!selectedFormatId || createDownload.isPending}
                    >
                      {createDownload.isPending ? "Starting..." : "Download"}
                      <Download className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {jobStatus && (
        <Card className="border-primary/50 bg-card/80 backdrop-blur shadow-2xl animate-in slide-in-from-bottom-8">
          <CardContent className="p-8 flex flex-col items-center text-center gap-6">
            {jobStatus.status === 'pending' || jobStatus.status === 'processing' ? (
              <>
                <div className="space-y-2 w-full max-w-md">
                  <h3 className="text-xl font-semibold">Processing your file...</h3>
                  <p className="text-sm text-muted-foreground">{jobStatus.videoTitle}</p>
                </div>
                <div className="w-full max-w-md space-y-2">
                  <Progress value={jobStatus.progress || 0} className="h-3" />
                  <div className="text-sm font-mono text-primary text-right">{Math.round(jobStatus.progress || 0)}%</div>
                </div>
              </>
            ) : jobStatus.status === 'done' ? (
              <>
                <div className="h-16 w-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-green-500">
                    {jobStatus.fileAvailable ? "Ready to save!" : "Conversion complete"}
                  </h3>
                  <p className="text-muted-foreground">{jobStatus.videoTitle}</p>
                </div>
                {jobStatus.fileAvailable ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      The temporary file is removed from the server after download or after one hour.
                    </p>
                    <Button
                      size="lg"
                      className="w-full max-w-xs text-lg h-14 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        window.location.href = getDownloadFileUrl(jobStatus.id);
                      }}
                    >
                      Save to device <Download className="ml-2 h-5 w-5" />
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    The server does not keep completed files. Start another conversion to download the file again.
                  </p>
                )}
                <Button variant="ghost" onClick={() => { setJobId(null); setVideoInfo(null); form.reset(); }}>
                  Convert another
                </Button>
              </>
            ) : (
              <>
                <div className="h-16 w-16 bg-destructive/20 text-destructive rounded-full flex items-center justify-center">
                  <AlertCircle className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-destructive">Conversion Failed</h3>
                  <p className="text-muted-foreground">{jobStatus.error || "An unknown error occurred."}</p>
                </div>
                <Button variant="outline" onClick={() => setJobId(null)}>Try Again</Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <AdMobile />
    </div>
  );
}

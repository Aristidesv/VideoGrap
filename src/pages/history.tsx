import { ProtectedRoute } from "@/components/protected-route";
import { useGetHistory } from "@/lib/api-client-react";
import { format } from "date-fns";
import { ExternalLink, FileVideo } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export default function HistoryPage() {
  return (
    <ProtectedRoute>
      <HistoryContent />
    </ProtectedRoute>
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function HistoryContent() {
  const { data, isLoading } = useGetHistory({ limit: 50 });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analysis History</h1>
        <p className="text-muted-foreground mt-2">
          Your latest 50 video analyses. Downloaded files are not kept on the server.
        </p>
      </div>

      <div className="border border-border/50 rounded-xl overflow-hidden bg-card/50 backdrop-blur">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Video</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Date analyzed</TableHead>
              <TableHead className="text-right">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Loading analysis history...
                </TableCell>
              </TableRow>
            ) : data?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  No video analyses yet.
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      {record.thumbnail ? (
                        <img src={record.thumbnail} alt="" className="w-12 h-12 object-cover rounded bg-muted" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                          <FileVideo className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="max-w-[250px] truncate" title={record.videoTitle}>
                        {record.videoTitle}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{record.channel || "—"}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatDuration(record.duration)}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {format(new Date(record.analyzedAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="secondary">
                      <a href={record.videoUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

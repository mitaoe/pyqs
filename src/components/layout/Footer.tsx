export default function Footer() {
  return (
    <footer className="border-t bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">About MITAOE PYQs</h3>
            <p className="mt-4 text-sm text-gray-600">
              This is an independent interface for MITAOE question papers. 
              All papers are served directly from MITAOE servers.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Legal Notice</h3>
            <p className="mt-4 text-sm text-gray-600">
              We do not host any question papers directly. This is purely a metadata 
              service to improve discovery and access to MITAOE&apos;s question paper repository.
            </p>
          </div>
        </div>
        <div className="mt-8 border-t pt-8">
          <p className="text-center text-xs text-gray-600">
            © {new Date().getFullYear()} MITAOE PYQs. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
} 
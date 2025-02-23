export default function Footer() {
  return (
    <footer className="border-t border-accent bg-secondary">
      <div className="container mx-auto px-4 py-4">
        <p className="text-center text-sm text-content">
          MITAOE Question Papers • {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
} 
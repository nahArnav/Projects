package com.zerokinetics.app.ui.faculty

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.zerokinetics.app.R
import com.zerokinetics.app.network.models.AttendanceEntry

class AttendanceAdapter(
    private var items: List<AttendanceEntry> = emptyList()
) : RecyclerView.Adapter<AttendanceAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvName: TextView = view.findViewById(R.id.tvStudentName)
        val tvStatus: TextView = view.findViewById(R.id.tvStatus)
        val tvScore: TextView = view.findViewById(R.id.tvScore)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_attendance, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val entry = items[position]
        holder.tvName.text = entry.studentName
        holder.tvStatus.text = if (entry.status == "verified") "Verified" else "Failed"
        holder.tvStatus.setTextColor(
            ContextCompat.getColor(
                holder.itemView.context,
                if (entry.status == "verified") R.color.success else R.color.error
            )
        )
        holder.tvScore.text = String.format("%.2f", entry.verificationScore)
    }

    override fun getItemCount() = items.size

    fun updateData(newItems: List<AttendanceEntry>) {
        items = newItems
        notifyDataSetChanged()
    }
}
